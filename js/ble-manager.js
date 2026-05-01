const DEVICE_NAME_PREFIX = "Taekwondo_Smart_Sock";
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

const MAX_CONNECT_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const SERVICE_DISCOVERY_DELAY_MS = 600;

let bluetoothDevice = null;
let characteristic = null;
let onDisconnectCallback = null;
let heartbeatInterval = null;
let disconnectFired = false;

// Simple sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main connection entry point.
 * @param {Function} onDataReceived  — called with parsed JSON on each BLE notification
 * @param {Function} onDisconnect    — called once when the device disconnects
 * @param {Function} onProgress      — called with (stepMessage) strings for UI feedback
 * @returns {Promise<boolean>}
 */
export async function connectBLE(onDataReceived, onDisconnect, onProgress = () => {}) {
  try {
    // ── Clean up any previous stale connection ──
    cleanupPreviousConnection();

    onDisconnectCallback = onDisconnect;
    disconnectFired = false;

    // ── Step 1: Request Device ──
    onProgress('Scanning for devices…');
    console.log("[BLE] Requesting Bluetooth Device...");

    // =================================================================
    // [1] نسخة الهاردوير الحقيقي (بتبحث عن اسم الشراب بالظبط)
    // (اعمل مسح لعلامات الـ /* و */ اللي حواليها لما تستلم القطعة الحقيقية)
    // =================================================================
    /*
    bluetoothDevice = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: DEVICE_NAME_PREFIX }],
      optionalServices: [SERVICE_UUID]
    });
    */

    // =================================================================
    // [2] نسخة المحاكاة (التجربة بالموبايل - بتتجاهل الاسم وتدور بالـ UUID)
    // (اعملها تعليق لما تيجي تستخدم القطعة الحقيقية)
    // =================================================================
    bluetoothDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID]
    });

    console.log("[BLE] Device selected:", bluetoothDevice.name || bluetoothDevice.id);
    bluetoothDevice.addEventListener('gattserverdisconnected', handleDisconnectEvent);

    // ── Step 2: Connect to GATT Server (with retries for Android) ──
    onProgress('Connecting to device…');
    const server = await connectGattWithRetry(bluetoothDevice);

    // ── Step 3: Discover Service (with delay for Android) ──
    onProgress('Discovering services…');
    console.log("[BLE] Waiting for service discovery...");
    await sleep(SERVICE_DISCOVERY_DELAY_MS);

    let service;
    try {
      service = await server.getPrimaryService(SERVICE_UUID);
    } catch (serviceErr) {
      console.error("[BLE] Service not found. Retrying after longer delay...");
      // Android sometimes needs more time — retry once with a longer pause
      await sleep(1500);
      service = await server.getPrimaryService(SERVICE_UUID);
    }
    console.log("[BLE] Service found.");

    // ── Step 4: Get Characteristic ──
    onProgress('Setting up data channel…');
    characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
    console.log("[BLE] Characteristic found.");

    // ── Step 5: Start Notifications ──
    characteristic.addEventListener('characteristicvaluechanged', (event) => {
      handleCharacteristicValueChanged(event, onDataReceived);
    });

    await characteristic.startNotifications();
    console.log("[BLE] Notifications started.");

    // ── Step 6: Start Heartbeat ──
    startHeartbeat();
    onProgress('Connected!');

    return true;
  } catch (error) {
    console.error("[BLE] Connection Error:", error);

    // Provide a human-readable reason
    const reason = classifyError(error);
    onProgress(reason);

    // Clean up partial connection state
    cleanupPreviousConnection();

    return false;
  }
}

/**
 * Attempt gatt.connect() up to MAX_CONNECT_RETRIES times with increasing delays.
 * Android Chrome's BLE stack often fails on the first attempt.
 */
async function connectGattWithRetry(device) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_CONNECT_RETRIES; attempt++) {
    try {
      console.log(`[BLE] GATT connect attempt ${attempt}/${MAX_CONNECT_RETRIES}...`);
      const server = await device.gatt.connect();
      console.log("[BLE] GATT connected.");
      return server;
    } catch (err) {
      lastError = err;
      console.warn(`[BLE] Attempt ${attempt} failed:`, err.message);

      if (attempt < MAX_CONNECT_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * attempt;
        console.log(`[BLE] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Classify common Web Bluetooth errors into user-friendly messages.
 */
function classifyError(error) {
  const msg = (error.message || '').toLowerCase();

  if (msg.includes('user cancel') || msg.includes('chooser was cancelled')) {
    return 'Connection cancelled.';
  }
  if (msg.includes('gatt server') || msg.includes('connect')) {
    return 'Could not reach device. Make sure it is powered on and nearby.';
  }
  if (msg.includes('service') || msg.includes('not found')) {
    return 'Service not found. Is the correct firmware running?';
  }
  if (msg.includes('characteristic')) {
    return 'Data channel not found. Check device firmware.';
  }
  if (msg.includes('network')) {
    return 'Network error. Try again.';
  }
  return 'Connection failed: ' + (error.message || 'Unknown error');
}

/**
 * Cleanly tear down any existing connection / listeners before a new attempt.
 */
function cleanupPreviousConnection() {
  stopHeartbeat();
  try {
    if (bluetoothDevice) {
      bluetoothDevice.removeEventListener('gattserverdisconnected', handleDisconnectEvent);
      if (bluetoothDevice.gatt && bluetoothDevice.gatt.connected) {
        bluetoothDevice.gatt.disconnect();
      }
    }
  } catch (e) {
    console.warn("[BLE] Cleanup warning:", e);
  }
  bluetoothDevice = null;
  characteristic = null;
}

export function disconnectBLE() {
  stopHeartbeat();
  if (bluetoothDevice && bluetoothDevice.gatt && bluetoothDevice.gatt.connected) {
    bluetoothDevice.gatt.disconnect();
  }
}

// ── Heartbeat: polls every 2s to catch silent disconnections ──

function startHeartbeat() {
  stopHeartbeat();
  heartbeatInterval = setInterval(() => {
    if (!bluetoothDevice || !bluetoothDevice.gatt || !bluetoothDevice.gatt.connected) {
      console.warn("[BLE] Heartbeat: device no longer connected.");
      stopHeartbeat();
      triggerDisconnect();
    }
  }, 2000);
  console.log("[BLE] Heartbeat started (2000ms)");
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ── Disconnect handling (deduplicated) ──

function handleDisconnectEvent() {
  console.log("[BLE] gattserverdisconnected event fired");
  stopHeartbeat();
  triggerDisconnect();
}

function triggerDisconnect() {
  if (disconnectFired) return;
  disconnectFired = true;
  console.log("[BLE] Disconnect triggered → calling main.js callback");
  if (onDisconnectCallback) {
    onDisconnectCallback();
  }
}

function handleCharacteristicValueChanged(event, onDataReceived) {
  const value = event.target.value;
  const decoder = new TextDecoder('utf-8');
  const jsonString = decoder.decode(value);

  try {
    const data = JSON.parse(jsonString);
    if (onDataReceived) {
      onDataReceived(data);
    }
  } catch (err) {
    console.error("[BLE] Failed to parse incoming data:", err, jsonString);
  }
}