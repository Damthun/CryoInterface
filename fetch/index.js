// Utility functions
function handleResponse(res) {
    if (!res.ok) {
        throw new Error(`Network response was not ok: ${res.status}`);
    }
    return res.json();
}

function handleError(error) {
    console.error('Error fetching data:', error);
    alert("An error occurred.");
}
// Used to add instrument options to new-experiment view.
function addOptionToSelect(value, selectId) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    document.getElementById(selectId).appendChild(option);
}
// Used to show activity of a connection/operation.
function updateStatus(elementId, text, color) {
    const state = document.getElementById(elementId);
    state.innerHTML = text;
    state.style.border = `2px solid ${color}`;
}

function getPeriodSeconds() {
    const mins = document.getElementById("mins").valueAsNumber;
    const sec = document.getElementById("datarate").valueAsNumber;
    return (mins*60)+sec;
}
// Enables the temperature correlation checkboxes in response to chosen temperature probes.
function handleTempCheckboxClick(index) {
    let tempCheckbox = document.getElementById('temp' + index + 'Checkbox')
    let tempTextbox = document.getElementById("temp" + index);
    let v1Checkbox = document.getElementById('v1p' + index);
    let v2Checkbox = document.getElementById('v2p' + index);

    // Optional: Uncheck the v1 and v2 checkboxes when temp checkbox is unchecked

    if (tempCheckbox.checked) {
      v1Checkbox.disabled = false;
      v2Checkbox.disabled = false;
      tempTextbox.disabled = false;
      tempTextbox.setAttribute("required", "");


    }
    else if (!tempCheckbox.checked){
        v1Checkbox.disabled = true;
        v2Checkbox.disabled = true;
        tempTextbox.disabled = true;
        tempTextbox.removeAttribute("required")
    }
}

// Used specifically within the POST requests to reduce repeated code.
function handleApiRequest(endpoint, method, requestData, callback) {
    const json = JSON.stringify(requestData);
    fetch(endpoint, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            "length": json.length.toString()
        },
        method: method,
        body: json
    })
    .then(res => {
        if (res.status === 200) {
            return res.json(); // Parse response data and return it
        } else {
            throw new Error(`Request failed with status: ${res.status}`);
        }
    })
    .then(data => {
        callback(data); // Pass response data to the callback function
    })
    .catch(err => {
        console.log(err);
        console.log("Request failed.");
    });
}

// Variables to store which VNA images are displayed when clicking item within image-list.
let activeVNA = "vna1"; // Default to VNA 1
let activeButtonId = "vna1-image"; // Default to VNA 1 button
// Variable used within checkStatus function.
let prev_data = null;

//Main Functionalities.
function loadInstruments() {
    fetch('/api/loadInstruments')
        .then(handleResponse)
        .then(data => {
            Object.values(data).forEach(instrument => {
                const model = instrument["Model"];
                addOptionToSelect(model, 'vna1-type');
                addOptionToSelect(model, 'vna2-type');
            });
        })
        .catch(handleError);
}

function loadMetadata() {
    fetch('/api/metadata')
    .then(handleResponse)
    .then(data => {
        const metadata = {
            "experiment_title": "metadata-title",
            "name": "metadata-name",
            "cpa": "metadata-cpa",
            "date": "metadata-date",
            "logger": "metadata-logger",
            "temp1": "metadata-temp1",
            "temp2": "metadata-temp2",
            "temp3": "metadata-temp3",
            "temp4": "metadata-temp4",
            "vna1": "metadata-vna1",
            "vna2": "metadata-vna2",
            "vna1_type": "metadata-vna1-type",
            "vna2_type": "metadata-vna2-type",
            "v1_associated": "metadata-vna1-temps",
            "v2_associated": "metadata-vna2-temps"
        };
        for (const key in metadata) {
            const element = document.getElementById(metadata[key]);
            element.textContent = data[key] === null ? "[Not Selected]" : data[key];
        }
    })
    .catch(handleError);
}

function loadPorts() {
    fetch('/api/devices')
    .then(handleResponse)
    .then(data => {
        const selector = document.getElementById("port");
        selector.innerHTML = "";
        data.forEach(port => {
            const op = new Option(port, port);
            selector.add(op);
        });
    })
    .catch(handleError);
}

function refresh() {
    loadPorts();
}

function loadConfig() {
    fetch('/api/config')
    .then(res => res.json())
    .then(data => {
        const seconds = data.period % 60;
        document.getElementById('mins').value = Math.floor(data.period / 60);
        document.getElementById('datarate').value = seconds;
    })
    .catch(err => console.log(err));
}
// Sends JSON objects to client that will be used in buttons that can then request image URL from server.
function loadImageData() {
    let evtSource = new EventSource("api/stream_images");
    evtSource.addEventListener('image_info', (event) => {
        const imageData = JSON.parse(event.data);
        addButtonToList(imageData);
    });
}
// Ability to show image from server, this image is set based on which image-list button is active.
function displayImageFromServer() {
    fetch('/api/loadImage')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.blob();
    })
    .then(imageBlob => {
        // Convert blob to URL
        const imageUrl = URL.createObjectURL(imageBlob);

        // Display the image in the "image-container"
        const imageContainer = document.getElementById('image-container');
        const img = document.createElement('img');

        img.src = imageUrl;

        // Remove any existing image in the container
        imageContainer.innerHTML = '';

        // Append the new image to the container
        imageContainer.appendChild(img);
    })
    .catch(error => {
        console.error('Error loading image from server:', error);
    });
}
// Stream of temperature readings.
function displayReadings() {
    let evtSource = new EventSource("api/stream_readings");
    evtSource.addEventListener('temperature', (event) => {
        const data = JSON.parse(event.data);

        // Create a Date object using the timestamp.
        const t = new Date(data.time * 1000);

        Plotly.extendTraces('temp-plot', {x: [[t]], y: [[data.temp1]]}, [0]);
        Plotly.extendTraces('temp-plot', {x: [[t]], y: [[data.temp2]]}, [1]);
        Plotly.extendTraces('temp-plot', {x: [[t]], y: [[data.temp3]]}, [2]);
        Plotly.extendTraces('temp-plot', {x: [[t]], y: [[data.temp4]]}, [3]);
    });
}
// Used to change display of webapp.
function selectScreen() {
    fetch('/api/experiment_selected')
    .then(res => res.json())
    .then(selected => {
        if (selected) {
            let el = document.getElementById("new-experiment");
            el.style.display = "none";
            el = document.getElementById("dashboard");
            el.style.display = "block";
            // Call loadMetadata when switching to the dashboard
            loadMetadata();
        } else {
            let el = document.getElementById("new-experiment");
            el.style.display = "block";
            el = document.getElementById("dashboard");
            el.style.display = "none";
        }
    });
}

// Load stored buttons when the page is loaded; This call doesn't add button to storeButtonData.
function loadStoredButtons() {
    const storedButtons = JSON.parse(sessionStorage.getItem("storedButtons")) || [];
    // Create buttons for each stored button data
    storedButtons.forEach(buttonData => {
        addButtonToList(buttonData, false); // Pass false to prevent storing the button again
    });
}

// Function to store button information to sessionStorage
function storeButtonData(buttonData) {
    // Retrieve existing button data or initialize as an empty array
    let storedButtons = JSON.parse(sessionStorage.getItem("storedButtons")) || [];
    // Add the new button data to the array
    storedButtons.push(buttonData);
    // Store the updated array back to sessionStorage
    sessionStorage.setItem("storedButtons", JSON.stringify(storedButtons));
}


//Active button is changed to highlight.
function setActiveButtonColor(activeButtonId) {
    const vna1Button = document.getElementById("vna1-image");
    const vna2Button = document.getElementById("vna2-image");

    if (activeButtonId === "vna1-image") {
        vna1Button.style.backgroundColor = "#555"; // Set vna1-image background color to a darker color
        vna2Button.style.backgroundColor = ""; // Reset vna2-image background color
    } else if (activeButtonId === "vna2-image") {
        vna1Button.style.backgroundColor = ""; // Reset vna1-image background color
        vna2Button.style.backgroundColor = "#555"; // Set vna2-image background color to a darker color
    }
}
// Function to change which photoUrl is being sent to server
function handleButtonClick(buttonId) {
    // Update activeButtonId and activeVNA
    activeButtonId = buttonId;
    if (buttonId === "vna1-image") {
        activeVNA = "vna1";
    } else if (buttonId === "vna2-image") {
        activeVNA = "vna2";
    }
    // Update the active button color
    setActiveButtonColor(activeButtonId);
}
// Updates UI to show whether devices are actively connected.
function checkStatus() {
    fetch('/api/devices_connected')
    .then(res => res.json())
    .then(data => {
        updateStatus("tempStatus", data.temperature ? "Connected" : "Not Connected", data.temperature ? "green" : "red");
        updateStatus("vna1status", data.vna1 ? "Connected" : "Not Connected", data.vna1 ? "green" : "red");
        updateStatus("vna2status", data.vna2 ? "Connected" : "Not Connected", data.vna2 ? "green" : "red");
        prev_data = data;

        // Chain the second fetch call here
        return fetch('/api/running');
    })
    .then(res => res.json())
    .then(data => {
        updateStatus("dataStatus", data ? "Running" : "Stopped", data ? "green" : "red");
    })
    .catch(err => console.log(err));
}

// Post Request Functions.
// Deals with experiment form.
function ExpFrmHandler(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    let jsonObj = Object.fromEntries(formData.entries());
    console.log(jsonObj)
    handleApiRequest('/api/create_experiment', 'POST', jsonObj, () => {
        selectScreen();
    });
}
// disconnects devices and stops the ability to take more measurements.
function kill() {
    handleApiRequest('/api/kill', 'POST', null, () => {
        // Callback function to update UI or handle other actions on success
        updateStatus("dataStatus", "Experiment Ended", "red");
    });
}
// Starts the collection of data.
function start() {
    handleApiRequest('/api/start', 'POST', null, () => {
        // Callback function to update UI or perform other actions on success
        updateStatus("dataStatus", "Running", "green");
        alert("Data Collection started.");
    });
}
// Stops / Pauses the collection of data.
function stop() {
    handleApiRequest('/api/stop', 'POST', null, () => {
        // Callback function to update UI or perform other actions on success
        updateStatus("dataStatus", "Stopped", "red");
        alert("Data collection stopped.");
    });
}
// Connects serial logger.
function connect() {
    const port = document.getElementById("port").value;
    handleApiRequest('/api/connect', 'POST', port, () => {
        // Callback function to update UI or perform other actions on success
        updateStatus("tempStatus", "Connected", "green");
        alert("Successfully connected to logger.");
    });
}
// Connects VNA instrument.
function connectVNA1() {
    const host = document.getElementById("vna1IP").value; // Assuming there's an input field with id "vna1Host"
    handleApiRequest('/api/connect_vna1', 'POST', host, () => {
        // Callback function to update UI or perform other actions on success
        updateStatus("vna1status", "Connected", "green");
        alert("Successfully connected to VNA.");
    });
}
// Connects VNA instrument.
function connectVNA2() {
    const host = document.getElementById("vna2IP").value; // Assuming there's an input field with id "vna2Host"
    handleApiRequest('/api/connect_vna2', 'POST', host, () => {
        // Callback function to update UI or perform other actions on success
        updateStatus("vna2status", "Connected", "green");
        alert("Successfully connected to VNA.");
    });
}
// Changes configuration of data collection based on user input.
function cfgRate() {
    const cfgJSON = {
        "period": getPeriodSeconds(),
    };
    handleApiRequest('/api/config', 'POST', cfgJSON, (data) => {
        const seconds = data.period % 60;
        document.getElementById('mins').value = Math.floor(data.period / 60);
        document.getElementById('datarate').value = seconds;
        alert("Configuration updated.");
    });
}

// Function to add button to the list and optionally store it
function addButtonToList(data, storeButton = true) {
    const imageList = document.getElementById("image-list");
    const button = document.createElement("button");
    button.classList.add("button");
    button.textContent = data.display;
    button.style.fontSize = "10px";
    button.setAttribute("data-stamp", data.display);
    button.setAttribute("data-time", data.time);
    button.setAttribute("data-vna1", data.vna1);
    button.setAttribute("data-vna2", data.vna2);
    button.addEventListener("click", function() {
        handleButtonClick(this.getAttribute("data-time"));
        const photoUrl = activeVNA === "vna1" ? this.getAttribute("data-vna1") : this.getAttribute("data-vna2");
        displayImageFromServer(photoUrl);
        handleApiRequest('/api/get_photo', 'POST', { photoUrl: photoUrl }, () => {
            // Success callback can be added if needed
        });
    });
    imageList.appendChild(button);

    // Store the button data if storeButton is true
    if (storeButton) {
        storeButtonData({
            display: data.display,
            time: data.time,
            vna1: data.vna1,
            vna2: data.vna2
        });
    }
}

function init() {
    document.getElementById('date').valueAsDate = new Date();
    let formExp = document.getElementById("create-experiment");
    formExp.addEventListener("submit", ExpFrmHandler);

    document.getElementById("startup").addEventListener("click", start);
    document.getElementById("stop").addEventListener("click", stop);
    document.getElementById("shutdown").addEventListener("click", kill);
    document.getElementById("connect").addEventListener("click", connect);
    document.getElementById("connectVNA1").addEventListener("click", connectVNA1);
    document.getElementById("connectVNA2").addEventListener("click", connectVNA2);
    document.getElementById("cfgRate").addEventListener("click", cfgRate);
    document.getElementById("refresh").addEventListener("click", refresh);

    document.getElementById("vna1-image").addEventListener("click", function () {
        handleButtonClick("vna1-image");
    });
    document.getElementById("vna2-image").addEventListener("click", function () {
        handleButtonClick("vna2-image");
    });

    document.getElementById('vna1Checkbox').onchange = function () {
        let v1box = document.getElementById('vna1');
        v1box.disabled = !this.checked;
        let v1select = document.getElementById("vna1-temps");
        let vna1type = document.getElementById("vna1-type");
        vna1type.disabled = !this.checked
        let vna1probe = document.getElementById("vna1-probes");
        if (v1box.disabled) {
            v1select.style.display = "none";
            vna1probe.style.display = "none";
            if (v1select.hasAttribute("required")) {
                v1select.removeAttribute("required");
            }
        } else {
            v1select.setAttribute("required", "");
            v1box.setAttribute("required", "");
            vna1type.setAttribute("required", "");
            v1select.style.display = "flex";
            vna1probe.style.display = "flex";
        }
    };

    document.getElementById('vna2Checkbox').onchange = function () {
        let v2box = document.getElementById('vna2')
        v2box.disabled = !this.checked;
        let v2select = document.getElementById("vna2-temps");
        let vna2type = document.getElementById("vna2-type");
        vna2type.disabled = !this.checked
        let vna2probe = document.getElementById("vna2-probes");
        if (v2box.disabled) {
            v2select.style.display = "none";
            vna2probe.style.display = "none";
            if (v2select.hasAttribute("required")) {
                v2select.removeAttribute("required");
            }
        } else {
            v2select.setAttribute("required", "");
            v2box.setAttribute("required", "");
            vna2type.setAttribute("required", "");
            v2select.style.display = "flex";
            vna2probe.style.display = "flex";
        }
    };
    document.getElementById('vna1-temps').onchange = function () {
        let v1_selections = []
        let v1_assoc = document.getElementById('v1-associated');
        const checkboxes = document.querySelectorAll('#vna1-temps input[type="checkbox"]');
        for (let i = 0, len = checkboxes.length; i < len; i++) {
            if (checkboxes[i].checked) {
                v1_selections.push(checkboxes[i].value)

            }
        }

        v1_assoc.value = v1_selections
    };
    document.getElementById('vna2-temps').onchange = function () {
        let v2_selections = []
        let v2_assoc = document.getElementById('v2-associated');
        const checkboxes = document.querySelectorAll('#vna2-temps input[type="checkbox"]');
        for (let i = 0, len = checkboxes.length; i < len; i++) {
            if (checkboxes[i].checked) {
                v2_selections.push(checkboxes[i].value)
            }
        }
        v2_assoc.value = v2_selections
    };
    document.getElementById('logger').onchange = function () {
        let logger = document.getElementById('logger');
        let drops = document.getElementsByClassName("hidden");
        let t3text = document.getElementById("temp3")
        let t4text = document.getElementById("temp4")
        let v1toggle3 = document.getElementById('v1p3')
        let v1toggle4 = document.getElementById('v1p4')
        let v2toggle3 = document.getElementById('v2p3')
        let v2toggle4 = document.getElementById('v2p4')
        if (logger.value === "Omega 4SD") {
            for (let i = 0, len = drops.length; i < len; i++) {
                drops[i].style.display = "block";
            }
        } else if (logger.value === "ESP 32") {
            for (let i = 0, len = drops.length; i < len; i++) {
                drops[i].style.display = "none";
                t3text.removeAttribute("required")
                t4text.removeAttribute("required")
            }
            v1toggle3.disabled = true;
            v1toggle4.disabled = true;
            v2toggle3.disabled = true;
            v2toggle4.disabled = true;
        }

    };
    let tempPlot = Plotly.newPlot("temp-plot", {
        "data": [{
            "x": [],
            "y": [],
            "name": "Temp 1",
        }, {
            "x": [],
            "y": [],
            "name": "Temp 2",
        }, {
            "x": [],
            "y": [],
            "name": "Temp 3",
        }, {
            "x": [],
            "y": [],
            "name": "Temp 4",
        }],
        "layout": {
            "xaxis": {
                "title": {
                    "text": "Time",
                },
            },
            "yaxis": {
                "title": {
                    "text": "Temperature (Celcius)",
                },
            },
            "title": "Temperature vs Time"
        },
        "type": "line"
    });

    tempPlot.then(function () {
        // Function to update plot size to fit within the container
        function updatePlotSize() {
            let container = document.querySelector(".container");
            let containerWidth = container.offsetWidth;
            let containerHeight = container.offsetHeight;

            // Calculate the aspect ratio of the container
            let containerAspectRatio = containerWidth / containerHeight;

            // Calculate the plot width and height based on the container's aspect ratio
            let plotWidth = containerWidth * 0.9;
            let plotHeight = plotWidth / containerAspectRatio;

            // Update the plot layout with the calculated dimensions
            Plotly.relayout('temp-plot', {
                width: plotWidth,
                height: plotHeight
            });
}

// Listen for window resize events to update plot size
window.addEventListener('resize', updatePlotSize);

    });


    loadPorts();
    displayReadings();
    loadImageData();
    loadConfig();
    selectScreen();
    checkStatus();
    setInterval(checkStatus, 10000);
}

document.addEventListener("DOMContentLoaded", init);
document.addEventListener("DOMContentLoaded", loadInstruments);
document.addEventListener("DOMContentLoaded", displayImageFromServer);
document.addEventListener("DOMContentLoaded", loadStoredButtons);
document.addEventListener("DOMContentLoaded", checkStatus);
document.addEventListener("DOMContentLoaded", function() {
    setActiveButtonColor(activeButtonId); // Use the current activeButtonId value
});