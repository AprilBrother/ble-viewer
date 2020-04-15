// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

$(function () {
    const msgpack = require('msgpack5')()
        ejs = require('ejs'),
        fs = require('fs')

    var is_fetch = 1;

    /**
     * Load a ejs template.
     *
     * @param name
     * @param object
     *
     * @returns {String}
     */
    function loadTemplate(name, object) {
        var tpl = fs.readFileSync(__dirname + '/partials/' + name + '.ejs');
        return ejs.render(tpl.toString(), object);
    }

    function parseDevice(data) {
        /**
         * device name = TempTrack
         * length of device name = 9
         * 0xa, 0x9, TempTrack, 0x10, 0x16, 0x0318, 0x1A20, 0x64, 0x1234, 0x5678, 0x112233445566
         */
        let dataLength      = 10, 
            deviceOffset    = dataLength + 1,
            tempOffset      = dataLength + 5,
            batteryOffset   = dataLength + 7,
            majorOffset     = dataLength + 8,
            minorOffset     = dataLength + 10,
            macOffset       = dataLength + 12,
            keys = [0x10, 0x16, 0x03, 0x18];
        
        for (var i = deviceOffset, j = 0; j < keys.length; i++, j++) {
            if (data[i] == keys[j]) {
                continue;
            } else {
                return null;
            }
        }


        var parsed = {
            temperature: data[tempOffset] + data[tempOffset + 1] / 100,
            battery: data[batteryOffset],
            major: data[majorOffset] * 0x100 + data[majorOffset + 1],
            minor: data[minorOffset] * 0x100 + data[minorOffset + 1],
            mac: ""
        };

        console.log(data[majorOffset]);
        data.slice(-6).forEach((d) => {
            parsed.mac += d.toString(16).toUpperCase();
        });

        return parsed;
    }

    function toFormatHex(data) {
        var newString  = data.toString('hex').toUpperCase().match(/.{2}/g).join(' ');
        return newString;
    }

    $('#container').html(loadTemplate("server-form", null));
    $('#container').on('click', '#btn-test', function() {
        var mqtt = require('mqtt')
            host = 'mqtt://' + $('input[name=mqtt-host]').val(),
            port = parseInt($('input[name=mqtt-port]').val()),
            user = $('#mqtt-username').val(),
            pass = $('#mqtt-password').val(),
            topic = $('input[name=mqtt-topic]').val(),
            opt = {
                port: port
            }

        if (user.length) {
            opt.username = user;
            if (pass.length) {
                opt.password = pass;
            }
        }
        var client  = mqtt.connect(host, opt);

        client.on('connect', function () {
            console.log("connected")
            client.subscribe(topic)
        })

        $('#container').html(loadTemplate("devices-cont", null));
        client.on('message', function (topic, message) {
            if (!is_fetch) {
                return;
            }

            var data = msgpack.decode(message);
            if (typeof data.devices == "undefined") {
                return;
            }

            var t, filter = $('#mac-filter').val();
            data.matches = [];
            if (filter.length && !(filter.length % 2)) {
                filter = filter.toUpperCase().match(/.{2}/g).join(' ');
                for(var i = 0; i < data.devices.length; i++) {
                    t = toFormatHex(data.devices[i]);
                    if (t.substr(3, filter.length) != filter) {
                        delete data.devices[i];
                        continue;
                    }
                    data.devices[i] = t;
                }
            } 

            data.matches = [];
            for(var i = 0; i < data.devices.length; i++) {
                console.log(data.devices[i]);
                var adv = data.devices[i].slice(8);
                parsed = parseDevice(adv);
                if (parsed != null) {
                    parsed.rssi = data.devices[i][7];
                    data.matches.push(parsed);
                }
            }
            console.log(data.matches);
            data.cnt = data.matches.length;

            $('#cont-dev').prepend(loadTemplate('devices', data));
            //if (filter.length) {
            $('#cont-dev a').trigger("click");
            //}
            $('#cont-dev a:gt(15)').remove();
        })

        $('#opt-start').change(function() {
            is_fetch = 1;
        });

        $('#opt-pause').change(function() {
            is_fetch = 0;
        });

        $('#opt-stop').change(function() {
            client.end();
            $('#container').html(loadTemplate("server-form", null));
        });

        $('#cont-dev').on('click', 'a', function() {
            $('#cont-dev a').removeClass("active");
            $(this).addClass("active");
        });

    });
});
