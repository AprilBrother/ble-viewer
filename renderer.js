// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const msgpack = require('msgpack5')();

$("#btn-test").click(function() {
    var mqtt = require('mqtt')
        host = 'mqtt://' + $('input[name=mqtt-host]').val()
        port = parseInt($('input[name=mqtt-port]').val())
        topic = $('input[name=mqtt-topic]').val()

    var client  = mqtt.connect(host, {
        port: port
    })

    client.on('connect', function () {
        console.log("connected")
        client.subscribe(topic)
    })

    $('#container').html("");
    client.on('message', function (topic, message) {
        var data = msgpack.decode(message)
            devices = data.devices;
        delete data.devices;
        devices.splice(5);
        console.log(JSON.stringify(data));
        console.log(JSON.stringify(devices));

        $('#container').append(JSON.stringify(data) + "<br>");
        $("html, body").scrollTop($(document).height());
    })

});
