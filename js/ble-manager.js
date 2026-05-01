const DEVICE_NAME_PREFIX = "Taekwondo_Smart_Sock";
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

let bluetoothDevice = null;
let characteristic = null;
let onDisconnectCallback = null;
let heartbeatInterval = null;
let disconnectFired = false;

export async function connectBLE(onDataReceived, onDisconnect) {
    try {
        onDisconnectCallback = onDisconnect;
        disconnectFired = false;
        console.log("Requesting Bluetooth Device...");

       // Real Hardware
        // =================================================================

        /*
        bluetoothDevice = await navigator.bluetooth.requestDevice({
          filters: [{ namePrefix: DEVICE_NAME_PREFIX }],
          optionalServices: [SERVICE_UUID]
        });
        */
        // =================================================================

        // Only UUID Check
        // =================================================================

        bluetoothDevice = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [SERVICE_UUID]
        });
        // =================================================================

        bluetoothDevice.addEventListener('gattserverdisconnected', handleDisconnectEvent);

        console.log("Connecting to GATT Server...");
        const server = await bluetoothDevice.gatt.connect();

        console.log("Getting Service...");
        const service = await server.getPrimaryService(SERVICE_UUID);

        console.log("Getting Characteristic...");
        characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

        characteristic.addEventListener('characteristicvaluechanged', (event) => {
            handleCharacteristicValueChanged(event, onDataReceived);
        });

        await characteristic.startNotifications();
        console.log("Notifications started");

        // Start heartbeat polling
        startHeartbeat();

        return true;
    } catch (error) {
        console.error("BLE Connection Error:", error);
        return false;
    }
}

export function disconnectBLE() {
  stopHeartbeat();
  if (bluetoothDevice && bluetoothDevice.gatt.connected) {
    bluetoothDevice.gatt.disconnect();
  }
}

// ---- Heartbeat: polls every 2s to catch silent disconnections ----

function startHeartbeat() {
  stopHeartbeat(); // Clear any prior interval
  heartbeatInterval = setInterval(() => {
    if (!bluetoothDevice || !bluetoothDevice.gatt.connected) {
      console.warn("Heartbeat: device is no longer connected.");
      stopHeartbeat();
      triggerDisconnect();
    }
  }, 2000);
  console.log("Heartbeat started (2000ms)");
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ---- Disconnect handling (deduplicated) ----

function handleDisconnectEvent() {
  console.log("gattserverdisconnected event fired");
  stopHeartbeat();
  triggerDisconnect();
}

function triggerDisconnect() {
  // Prevent firing multiple times for the same disconnection
  if (disconnectFired) return;
  disconnectFired = true;

  console.log("Disconnect triggered → calling main.js callback");
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
    console.error("Failed to parse incoming BLE data:", err, jsonString);
  }
}