
const endpoint = "https://script.google.com/macros/s/AKfycby4MA0ASPsdGtVGA1egHL8a0KJ70q9NCLrUmkA5CbEPX0CATaPUoPrpjfw3_fGuNf6ZHA/exec";
const scanner = new Html5Qrcode("reader");
let videoTrack = null;
let lastScanned = "";
let signatureData = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// Signature canvas setup
let signatureCanvas, signatureCtx;

// Initialize signature functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeSignature();
});

function initializeSignature() {
    signatureCanvas = document.getElementById('signatureCanvas');
    signatureCtx = signatureCanvas.getContext('2d');
    
    // Set canvas size and styling
    const rect = signatureCanvas.getBoundingClientRect();
    signatureCanvas.width = rect.width;
    signatureCanvas.height = rect.height;
    
    // Set drawing context properties
    signatureCtx.strokeStyle = '#000000';
    signatureCtx.lineWidth = 2;
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';
    
    // Add event listeners for drawing
    signatureCanvas.addEventListener('mousedown', startDrawing);
    signatureCanvas.addEventListener('mousemove', draw);
    signatureCanvas.addEventListener('mouseup', stopDrawing);
    signatureCanvas.addEventListener('mouseout', stopDrawing);
    
    // Touch events for mobile devices
    signatureCanvas.addEventListener('touchstart', handleTouch);
    signatureCanvas.addEventListener('touchmove', handleTouch);
    signatureCanvas.addEventListener('touchend', stopDrawing);
}

function startDrawing(e) {
    isDrawing = true;
    const rect = signatureCanvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
}

function draw(e) {
    if (!isDrawing) return;
    
    const rect = signatureCanvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    signatureCtx.beginPath();
    signatureCtx.moveTo(lastX, lastY);
    signatureCtx.lineTo(currentX, currentY);
    signatureCtx.stroke();
    
    lastX = currentX;
    lastY = currentY;
}

function stopDrawing() {
    isDrawing = false;
}

function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 
                                    e.type === 'touchmove' ? 'mousemove' : 'mouseup', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    signatureCanvas.dispatchEvent(mouseEvent);
}

function clearSignature() {
    signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    signatureData = null;
    document.getElementById('signaturePreview').innerHTML = '';
}

function captureSignature() {
    if (signatureCanvas.width === 0 || signatureCanvas.height === 0) return;
    
    // Convert canvas to data URL
    signatureData = signatureCanvas.toDataURL('image/png');
    
    // Show preview
    const preview = document.getElementById('signaturePreview');
    preview.innerHTML = `<img src="${signatureData}" alt="Signature Preview">`;
    
    // Enable submit button if we have both data and signature
    checkInputs();
}

function sendToScript(data) {
    document.getElementById("loading").style.display = "flex";

    // Prepare the payload with signature if available
    let payload = data;
    if (signatureData) {
        payload = `${data}|SIGNATURE=${signatureData}`;
    }

    fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: payload
    }).then(res => res.text())
        .then(msg => {
            document.getElementById("status").innerText = msg;
            document.getElementById("submitBtn").disabled = true;
            document.getElementById("scannedText").innerText = "No scan yet...";
            document.getElementById("manualInput").value = "";
            document.getElementById("yearLevel").value = ""; 
            lastScanned = "";
            clearSignature(); // Clear signature after successful submission
        }).catch((error) => { 
            console.error("Error sending data:", error);
            document.getElementById("status").innerText = "Failed to send: " + error.message; 
        }).finally(() => {
            document.getElementById("loading").style.display = "none";
        });
}

function submitAttendance() {
    const yearLevel = document.getElementById("yearLevel").value;
    const manualInput = document.getElementById("manualInput").value.trim();
    const statusEl = document.getElementById("status");
    const submitBtn = document.getElementById("submitBtn");

    if (!yearLevel) {
        alert("Please select year level.");
        return;
    }

    let payload = manualInput
        ? `${manualInput}|YEARLEVEL=${yearLevel}`
        : lastScanned
            ? `${lastScanned}|YEARLEVEL=${yearLevel}`
            : null;

    if (!payload) {
        alert("No scanned or manual data found.");
        return;
    }

    // Add signature data if available
    if (signatureData) {
        payload = `${payload}|SIGNATURE=${signatureData}`;
    }

    statusEl.innerText = "Sending...";
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
            document.getElementById("yearLevel").value = "";
            lastScanned = "";
            clearSignature(); // Clear signature after successful submission
        }).catch((error) => { 
            console.error("Error sending data:", error); 
            statusEl.innerText = "Failed to send: " + error.message;
        }).finally(() => {
            document.getElementById("loading").style.display = "none";
            submitBtn.disabled = true; 
        });

    closePopup();
}

function onScanSuccess(decodedText) {
    lastScanned = decodedText;
    document.getElementById("scannedText").innerText = decodedText;
    document.getElementById("status").innerText = "QR scanned. Select year level.";
    checkInputs();
    showPopup(decodedText);
}

function showPopup(text) {
    const popup = document.getElementById("popup");
    const overlay = document.getElementById("overlay");
    document.getElementById("popupContent").innerText = text;
    overlay.classList.add("show");
    popup.classList.add("show");
    popup.style.display = "block"; 
    overlay.style.display = "block";
}

function closePopup() {
    const popup = document.getElementById("popup");
    const overlay = document.getElementById("overlay");
    popup.classList.remove("show");
    overlay.classList.remove("show");
    setTimeout(() => {
        popup.style.display = "none";
        overlay.style.display = "none";
    }, 400); 
}

function checkInputs() {
    const manualInput = document.getElementById("manualInput").value.trim();
    const enable = manualInput || lastScanned;
    document.getElementById("submitBtn").disabled = !enable;
    
    // Note: Signature is optional, so we don't disable the submit button if no signature
    // But we can show a visual indicator if signature is missing
    const submitBtn = document.getElementById("submitBtn");
    if (enable && !signatureData) {
        submitBtn.style.borderColor = "#ff9800"; // Orange border to indicate missing signature
        submitBtn.title = "Note: No signature captured. Attendance will be recorded without signature.";
    } else if (enable && signatureData) {
        submitBtn.style.borderColor = "#4caf50"; // Green border to indicate complete data
        submitBtn.title = "Complete data ready for submission.";
    } else {
        submitBtn.style.borderColor = ""; // Reset to default
        submitBtn.title = "";
    }
}

Html5Qrcode.getCameras().then(devices => {
    if (devices && devices.length) {
        const backCam = devices.find(device =>
            device.label.toLowerCase().includes("back") ||
            device.label.toLowerCase().includes("rear")
        ) || devices[0];

        scanner.start(
            { deviceId: { exact: backCam.id } },
            { 
                fps: 10, 
                qrbox: { width: 250, height: 250 }
            },
            onScanSuccess
        ).then(() => {
            enableZoomControl();
            document.getElementById("status").innerText = "Scanning ready. Look for a QR code.";
        }).catch(err => {
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
    document.getElementById("status").innerText = "Error accessing cameras. Make sure you're on HTTPS.";
    console.error("Get cameras error:", err);
});

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
                slider.value = caps.zoom.min;
                slider.disabled = false;
                slider.oninput = () => {
                    videoTrack.applyConstraints({ advanced: [{ zoom: parseFloat(slider.value) }] })
                        .catch(e => console.error("Error setting zoom:", e));
                };
            } else {
                slider.disabled = true;
            }
        }
    }, 1000); 
}

document.getElementById("yearLevel").addEventListener("change", checkInputs);

checkInputs();
