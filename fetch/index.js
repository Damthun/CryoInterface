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

function addOptionToSelect(value, selectId) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    document.getElementById(selectId).appendChild(option);
}

function updateStatus(elementId, text, color) {
    const state = document.getElementById(elementId);
    state.innerHTML = text;
    state.style.border = `2px solid ${color}`;
}

function handleVnaResponse(statusElementId) {
    return function (res) {
        if (res.status === 200) {
            const state = document.getElementById(statusElementId);
            state.innerHTML = "Connected";
            state.style.border = '2px solid green';
            return res.json();
        } else {
            const state = document.getElementById(statusElementId);
            state.innerHTML = "Not Connected";
            state.style.border = '2px solid red';
            return Promise.reject("Failed to connect to VNA.");
        }
    };
}

//Main Functionalities.
function kill() {
    fetch('/api/kill', {
        method: 'POST'
    })
    .then(handleResponse)
    .then(data => {
        updateStatus("dataStatus", "Stopped", "red");
        alert(data);
    })
    .catch(handleError);
}

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

function start() {
    fetch('/api/start', {
        method: 'POST'
    })
    .then(handleResponse)
    .then(data => {
        updateStatus("dataStatus", "Running", "green");
        alert(data);
    })
    .catch(handleError);
}

function stop() {
    fetch('/api/stop', {
        method: 'POST'
    })
    .then(handleResponse)
    .then(data => {
        updateStatus("dataStatus", "Stopped", "red");
        alert(data);
    })
    .catch(handleError);
}
function connect() {
    const port = document.getElementById("port").value;
    const json = JSON.stringify(port);
    fetch('/api/connect', {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            "length": json.length.toString()
        },
        method: "POST",
        body: json
    })
    .then(handleResponse)
    .then(data => {
        updateStatus("tempStatus", "Connected", "green");
        alert(data);
    })
    .catch(handleError);
}

function connectVNA1() {
    const port = document.getElementById("vna1IP").value;
    const json = JSON.stringify(port);
    fetch('/api/connect_vna1', {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            "length": json.length.toString()
        },
        method: "POST",
        body: json
    })
    .then(handleVnaResponse("vna1status"))
    .then(data => alert(data))
    .catch(handleError);
}

function connectVNA2() {
    const port = document.getElementById("vna2IP").value;
    const json = JSON.stringify(port);
    fetch('/api/connect_vna2', {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            "length": json.length.toString()
        },
        method: "POST",
        body: json
    })
    .then(handleVnaResponse("vna2status"))
    .then(data => alert(data))
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


function ExpFrmHandler(event) {
    event.preventDefault();
    // capture the form data
    const formData = new FormData(event.target);
    // convert the form data to JSON format
    let jsonObj = Object.fromEntries(formData.entries());
    // We want these as null, not empty string.
    if (jsonObj.vna1_temp === "") {
        jsonObj.vna1_temp = null;
    }
    if (jsonObj.vna2_temp === "") {
        jsonObj.vna2_temp = null;
    }
    console.log(jsonObj);
    const jsonData = JSON.stringify(jsonObj);

    fetch('/api/create_experiment', {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                "length": jsonData.length.toString()
            },
            method: "POST",
            body: jsonData
        })
        .then(() => {
            selectScreen();
        })
        .catch(()=> {
            console.log("Failed to create experiment");
        });
}

function displayData() {
    var evtSource = new EventSource("api/stream_data");
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

function cfgRate() {
    var cfgJSON = {
        "period": getPeriodSeconds(),
    };
    fetch('/api/config', {
        method:'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'length': JSON.stringify(cfgJSON).length.toString(),
        },
        body: JSON.stringify(cfgJSON),
    })
    .then(res => res.json())
    .then(data => {
        const seconds = data.period % 60;
        document.getElementById('mins').value = Math.floor(data.period / 60);
        document.getElementById('datarate').value = seconds;
        alert("Configuration updated.");
    })
    .catch(err =>{
        console.log(err);
        alert("Failed to update configuration.");
    });
}

function getPeriodSeconds() {
    const mins = document.getElementById("mins").valueAsNumber;
    const sec = document.getElementById("datarate").valueAsNumber;

    return (mins*60)+sec;
}

var prev_data = null;

function checkStatus() {
    fetch('/api/devices_connected')
    .then(res =>{
        return res.json();
    })
    .then(data =>{
        if (data.temperature) {
            const state = document.getElementById("tempStatus");
            state.innerHTML = "Connected";
            state.style.border = '2px solid green';
        } else {
            const state = document.getElementById("tempStatus");
            state.innerHTML = "Not Connected";
            state.style.border = '2px solid red';
            if (prev_data?.temperature) {
                alert("Temperature sensor has disconnected.");
            }
        }

        if (data.vna1) {
            const state = document.getElementById("vna1status");
            state.innerHTML = "Connected";
            state.style.border = '2px solid green';
        } else {
            const state = document.getElementById("vna1status");
            state.innerHTML = "Not Connected";
            state.style.border = '2px solid red';
            if (prev_data?.vna1) {
                alert("VNA1 has disconnected.");
            }
        }

        if (data.vna2) {
            const state = document.getElementById("vna2status");
            state.innerHTML = "Connected";
            state.style.border = '2px solid green';
        } else {
            const state = document.getElementById("vna2status");
            state.innerHTML = "Not Connected";
            state.style.border = '2px solid red';
            if (prev_data?.vna2) {
                alert("VNA2 has disconnected.");
            }
        }

        prev_data = data;
    });

    fetch('/api/running')
    .then(res => res.json())
    .then(data => {
        if (data) {
            const state = document.getElementById("dataStatus");
            state.innerHTML = "Running";
            state.style.border = '2px solid green';
        } else {
            const state = document.getElementById("dataStatus");
            state.innerHTML = "Stopped";
            state.style.border = '2px solid red';
        }
    })
    .catch(err => console.log(err));
}

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
      tempTextbox.setAttribute("required", true);


    }
    else if (!tempCheckbox.checked){
        v1Checkbox.disabled = true;
        v2Checkbox.disabled = true;
        tempTextbox.disabled = true;
        tempTextbox.removeAttribute("required")
    }
}

function init() {
    document.getElementById('date').valueAsDate = new Date();

    // var experiment-selected = false;
    var formExp = document.getElementById("create-experiment");
    formExp.addEventListener("submit", ExpFrmHandler);

    document.getElementById("startup").addEventListener("click", start);
    document.getElementById("stop").addEventListener("click", stop);
    document.getElementById("shutdown").addEventListener("click", kill);
    document.getElementById("connect").addEventListener("click", connect);
    document.getElementById("connectVNA1").addEventListener("click", connectVNA1);
    document.getElementById("connectVNA2").addEventListener("click", connectVNA2);
    document.getElementById("cfgRate").addEventListener("click", cfgRate);
    document.getElementById("refresh").addEventListener("click", refresh);


    document.getElementById('vna1Checkbox').onchange = function() {
        let v1box = document.getElementById('vna1');
        v1box.disabled = !this.checked;
        let v1select = document.getElementById("vna1-temps");
        let vna1type = document.getElementById("vna1-type");
        vna1type.disabled = !this.checked
        let vna1probe = document.getElementById("vna1-probes");
        if(v1box.disabled){
            v1select.style.display = "none";
            vna1probe.style.display = "none";
            if(v1select.hasAttribute("required")){
                v1select.removeAttribute("required");
            }
        }
        else{
            v1select.setAttribute("required", true);
            v1box.setAttribute("required", true);
            vna1type.setAttribute("required", true);
            v1select.style.display = "flex";
            vna1probe.style.display = "flex";
        }
    };

    document.getElementById('vna2Checkbox').onchange = function() {
        let v2box = document.getElementById('vna2')
        v2box.disabled = !this.checked;
        let v2select = document.getElementById("vna2-temps");
        let vna2type = document.getElementById("vna2-type");
        vna2type.disabled = !this.checked
        let vna2probe = document.getElementById("vna2-probes");
        if(v2box.disabled){
            v2select.style.display = "none";
            vna2probe.style.display = "none";
            if(v2select.hasAttribute("required")){
                v2select.removeAttribute("required");
            }
        }
        else{
            v2select.setAttribute("required", true);
            v2box.setAttribute("required", true);
            vna2type.setAttribute("required", true);
            v2select.style.display = "flex";
            vna2probe.style.display = "flex";
        }
    };
    document.getElementById('vna1-temps').onchange = function () {
        let v1_selections = []
        let v1_assoc = document.getElementById('v1-associated');
        const checkboxes = document.querySelectorAll('#vna1-temps input[type="checkbox"]');
        console.log(checkboxes)
        for (let i = 0, len = checkboxes.length; i < len; i++) {
            if(checkboxes[i].checked){
                v1_selections.push(checkboxes[i].value)

            }
            }

        v1_assoc.value = v1_selections
    };
    document.getElementById('vna2-temps').onchange = function () {
        let v2_selections = []
        let v2_assoc = document.getElementById('v2-associated');
        const checkboxes = document.querySelectorAll('#vna2-temps input[type="checkbox"]');
        console.log(checkboxes)
        for (let i = 0, len = checkboxes.length; i < len; i++) {
            if(checkboxes[i].checked){
                v2_selections.push(checkboxes[i].value)
            }
            }
        v2_assoc.value = v2_selections
    };
    document.getElementById('logger').onchange = function() {
        let logger = document.getElementById('logger');
        let drops = document.getElementsByClassName("hidden");
        let t3text = document.getElementById("temp3")
        let t4text = document.getElementById("temp4")
        let v1toggle3 = document.getElementById('v1p3')
        let v1toggle4 = document.getElementById('v1p4')
        let v2toggle3 = document.getElementById('v2p3')
        let v2toggle4 = document.getElementById('v2p4')
        if(logger.value === "Omega 4SD") {
            for (let i = 0, len = drops.length; i < len; i++) {
                drops[i].style.display = "block";
            }
        }
        else if(logger.value === "ESP 32"){
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

Plotly.newPlot("temp-plot", {
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
            "width": 800,
            "height": 500,
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
            "title": "Temperature vs Time"},
        "type": "line"
    });

    loadPorts();
    loadConfig();

    displayData();

    selectScreen();

    checkStatus();

    setInterval(checkStatus, 10000);
}

document.addEventListener("DOMContentLoaded", init);
document.addEventListener("DOMContentLoaded", loadInstruments);