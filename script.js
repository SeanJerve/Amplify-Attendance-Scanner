        const endpoint = "https://script.google.com/macros/s/AKfycbyBZfiJDgZZNAjNkhEA874yzZOogjCX8inYtwDYu6HHU3CAVKbcP4dbqd7FMsXHqn-ssw/exec";
        const scanner = new Html5Qrcode("reader");
        let videoTrack = null;
        let lastScanned = "";
        let signaturePad;

        // ===== Signature Pad Init =====
        function initSignaturePad() {
            const canvas = document.getElementById("signature-pad");
            if (!canvas) return;

            // Resize canvas to fit device pixel ratio
            function resizeCanvas() {
                const ratio = Math.max(window.devicePixelRatio || 1, 1);
                canvas.width = canvas.offsetWidth * ratio;
                canvas.height = canvas.offsetHeight * ratio;
                canvas.getContext("2d").scale(ratio, ratio);
            }
            window.addEventListener("resize", resizeCanvas);
            resizeCanvas();

            signaturePad = new SignaturePad(canvas, {
                backgroundColor: "rgba(255,255,255,0)",
                penColor: "black"
            });
        }

        function clearSignature() {
            if (signaturePad) signaturePad.clear();
        }

        // ========== SEND TO SCRIPT ==========
        function sendToScript(data, signatureDataUrl = null) {
            document.getElementById("loading").style.display = "flex";

            // Include signature image if provided
            let payload = data;
            if (signatureDataUrl) {
                payload += `|SIGNATURE=${signatureDataUrl}`;
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
                    clearSignature();
                }).catch((error) => {
                    console.error("Error sending data:", error);
                    document.getElementById("status").innerText = "Failed to send: " + error.message;
                }).finally(() => {
                    document.getElementById("loading").style.display = "none";
                });
        }

        // ========== SUBMIT ATTENDANCE ==========
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

            // Capture signature if exists
            let signatureDataUrl = null;
            if (signaturePad && !signaturePad.isEmpty()) {
                signatureDataUrl = signaturePad.toDataURL();
            }

            statusEl.innerText = "Sending...";
            submitBtn.disabled = true;
            document.getElementById("loading").style.display = "flex";

            sendToScript(payload, signatureDataUrl);
            closePopup();
        }

        // ========== SCANNER ==========
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

        // Initialize signature pad after DOM loads
        window.addEventListener("load", initSignaturePad);
