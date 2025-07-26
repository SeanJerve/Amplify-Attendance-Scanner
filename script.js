
const endpoint = "https://script.google.com/macros/s/AKfycbyNtSknNXOtXrbnwO7WIXcVNJf5KI-M0T0wvIguLiVTjgnc8cnGnUooSCmDsUuYyPWo/exec";
const scanner = new Html5Qrcode("reader");
let videoTrack = null;
let lastScanned = "";

// Function to send data to Google Apps Script
function sendToScript(data) {
    document.getElementById("loading").style.display = "flex";

    fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: data
    }).then(res => res.text())
        .then(msg => {
            document.getElementById("status").innerText = msg;
            document.getElementById("submitBtn").disabled = true;
            document.getElementById("scannedText").innerText = "No scan yet...";
            document.getElementById("manualInput").value = "";
            document.getElementById("yearLevel").value = ""; // Clear year level after successful submission
            lastScanned = "";
        }).catch((error) => { // Catch the error object
            console.error("Error sending data:", error); // Log the actual error
            document.getElementById("status").innerText = "Failed to send: " + error.message; // Display specific error
        }).finally(() => {
            document.getElementById("loading").style.display = "none";
        });
}

// Function to handle attendance submission
function submitAttendance() {
    const yearLevel = document.getElementById("yearLevel").value;
    const manualInput = document.getElementById("manualInput").value.trim();
    const statusEl = document.getElementById("status");
    const submitBtn = document.getElementById("submitBtn");

    if (!yearLevel) {
        alert("Please select year level.");
        return;
    }

    const payload = manualInput
        ? `${manualInput}|YEARLEVEL=${yearLevel}`
        : lastScanned
            ? `${lastScanned}|YEARLEVEL=${yearLevel}`
            : null;

    if (!payload) {
        alert("No scanned or manual data found.");
        return;
    }

    statusEl.innerText = "⏳ Sending...";
    submitBtn.disabled = true;
    document.getElementById("loading").style.display = "flex";

    fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: payload
    }).then(res => res.text())
        .then(msg => {
            statusEl.innerText = msg;
            document.getElementById("scannedText").innerText = "No scan yet...";
            document.getElementById("manualInput").value = "";
            document.getElementById("yearLevel").value = ""; // Clear year level after successful submission
            lastScanned = "";
        }).catch((error) => { // Catch the error object
            console.error("Error sending data:", error); // Log the actual error
            statusEl.innerText = "Failed to send: " + error.message; // Display specific error
        }).finally(() => {
            document.getElementById("loading").style.display = "none";
            submitBtn.disabled = true; // Keep disabled until new scan/input
        });

    closePopup();
}

// Callback function on successful QR scan
function onScanSuccess(decodedText) {
    lastScanned = decodedText;
    document.getElementById("scannedText").innerText = decodedText;
    document.getElementById("status").innerText = "✅ QR scanned. Select year level.";
    checkInputs(); // Re-enable submit button if conditions met
    showPopup(decodedText);
}

// Function to display popup
function showPopup(text) {
    const popup = document.getElementById("popup");
    const overlay = document.getElementById("overlay");
    document.getElementById("popupContent").innerText = text;
    overlay.classList.add("show");
    popup.classList.add("show");
    popup.style.display = "block"; 
    overlay.style.display = "block";
}

// Function to close popup
function closePopup() {
    const popup = document.getElementById("popup");
    const overlay = document.getElementById("overlay");
    popup.classList.remove("show");
    overlay.classList.remove("show");
    setTimeout(() => {
        popup.style.display = "none";
        overlay.style.display = "none";
    }, 400); // This duration should match your CSS transition duration for the popup
}

// Check if manual input or scanned text is present to enable/disable submit button
function checkInputs() {
    const manualInput = document.getElementById("manualInput").value.trim();
    const enable = manualInput || lastScanned;
    document.getElementById("submitBtn").disabled = !enable;
}

// Initialize QR scanner and camera
Html5Qrcode.getCameras().then(devices => {
    if (devices && devices.length) {
        // Prefer back camera, otherwise use the first available camera
        const backCam = devices.find(device =>
            device.label.toLowerCase().includes("back") ||
            device.label.toLowerCase().includes("rear")
        ) || devices[0];

        scanner.start(
            { deviceId: { exact: backCam.id } },
            { 
                fps: 10, 
                qrbox: { width: 250, height: 250 } // Explicitly set square scanning box
            },
            onScanSuccess,
            (errorMessage) => { // Error callback for scanner
                console.warn(`QR Code scanning error: ${errorMessage}`);
                // You can update a status message here if needed, but avoid spamming
            }
        ).then(() => {
            // Start enabled zoom control after scanner successfully starts
            enableZoomControl();
            document.getElementById("status").innerText = "Scanning ready. Look for a QR code.";
        }).catch(err => {
            // Catch errors related to starting the camera
            let statusMessage = "Failed to start camera.";
            if (err.name === "NotAllowedError") {
                statusMessage = "Camera access denied. Please allow camera in browser settings.";
            } else if (err.name === "NotFoundError") {
                statusMessage = "No camera found or accessible.";
            } else {
                statusMessage += ` Error: ${err.message}`;
            }
            document.getElementById("status").innerText = statusMessage;
            console.error("Camera start error:", err);
        });
    } else {
        document.getElementById("status").innerText = "No camera found on this device.";
    }
}).catch(err => {
    // Catch errors related to getting camera devices
    document.getElementById("status").innerText = "Error accessing cameras. Make sure you're on HTTPS.";
    console.error("Get cameras error:", err);
});

// Enable zoom control for camera
function enableZoomControl() {
    setTimeout(() => {
        const video = document.querySelector("video");
        if (video && video.srcObject) {
            videoTrack = video.srcObject.getVideoTracks()[0];
            const caps = videoTrack.getCapabilities?.();
            const slider = document.getElementById("zoomSlider");

            if (caps && caps.zoom) {
                slider.min = caps.zoom.min;
                slider.max = caps.zoom.max;
                slider.step = caps.zoom.step || 0.1;
                slider.value = caps.zoom.min; // Start at minimum zoom
                slider.disabled = false;
                slider.oninput = () => {
                    videoTrack.applyConstraints({ advanced: [{ zoom: parseFloat(slider.value) }] })
                        .catch(e => console.error("Error setting zoom:", e));
                };
            } else {
                // If zoom is not supported, disable the slider and hide if preferred
                slider.disabled = true;
                // You might want to hide the slider if zoom is not available
                // slider.style.display = 'none'; 
            }
        }
    }, 1000); // Give a moment for video stream to initialize
}

// Listener for year level selection to enable/disable submit button
document.getElementById("yearLevel").addEventListener("change", checkInputs);

// Initial check on load
checkInputs();
