$("#btn-test").click(function() {
    var mqtt = require('mqtt')
        host = 'mqtt://' + $('input[name=mqtt-host]').val()
        port = parseInt($('input[name=mqtt-port]').val())

    var client  = mqtt.connect(host, {
        port: port
    })

    client.on('connect', function () {
        console.log("connected")
        client.subscribe("/beacons")
    })


    $('#container').html("");
    client.on('message', function (topic, message) {
        $('#container').append(message.toString());
        $("html, body").scrollTop($(document).height());

      // message is Buffer
      //console.log(message.toString())
      //client.end()
    })

});
