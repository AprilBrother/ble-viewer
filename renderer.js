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

    /**
     * Convert a device payload to a spaced, upper-case hex string.
     * Accepts a Buffer (msgpack) or a hex string (JSON).
     */
    function toFormatHex(data) {
        if (typeof data === 'string') {
            var hex = data.replace(/[\s:-]/g, '');
            var pairs = hex.match(/.{2}/g);
            return pairs ? pairs.join(' ').toUpperCase() : hex.toUpperCase();
        }
        return data.toString('hex').toUpperCase().match(/.{2}/g).join(' ');
    }

    /**
     * Decode an MQTT payload. JSON packets are decoded as text, everything
     * else is treated as msgpack.
     *
     * @param message Buffer
     *
     * @returns {Object}
     */
    function decodePayload(message) {
        var text = message.toString('utf8').trim();
        if (text.charAt(0) === '{' || text.charAt(0) === '[') {
            try {
                return JSON.parse(text);
            } catch (e) {
                console.log('Invalid JSON payload, fallback to msgpack:', e.message);
            }
        }
        return msgpack.decode(message);
    }

    /**
     * Normalise one device entry to { mac, text }.
     *
     * JSON packets use [type, mac, rssi, data]. msgpack packets carry the same
     * fields packed in a Buffer: [type][mac x 6][rssi][data...].
     *
     * @param device
     *
     * @returns {Object}
     */
    function normalizeDevice(device) {
        if (Array.isArray(device)) {
            return {
                type: device[0],
                mac: toFormatHex(String(device[1])),
                rssi: device[2],
                text: toFormatHex(String(device[3]))
            };
        }

        if (!Buffer.isBuffer(device) || device.length < 8) {
            return { type: '', mac: '', rssi: '', text: toFormatHex(device) };
        }

        // msgpack: [type][mac x 6][rssi][data...]
        return {
            type: device.readUInt8(0),
            mac: toFormatHex(device.slice(1, 7)),
            rssi: device.readInt8(7),
            text: toFormatHex(device.slice(8))
        };
    }

    function loadFormData() {
        let serverData = localStorage.getItem('server-data') 
        let params = new URLSearchParams(serverData)
        for (const e of params.entries()) {
            $(`#${e[0]}`).val(e[1])
        }
    }

    $('#container').html(loadTemplate("server-form", null));
    loadFormData()
    $('#container').on('click', '#btn-test', function() {
        let formData = $('#f-server').serialize()
        localStorage.setItem('server-data', formData)

        var mqtt = require('mqtt'),
            host = $('input[name=mqtt-host]').val(),
            port = parseInt($('input[name=mqtt-port]').val()),
            user = $('#mqtt-username').val(),
            pass = $('#mqtt-password').val(),
            topic = $('input[name=mqtt-topic]').val(),
            opt = { 
                host: host,
                port: port,
                keepalive: 1000 
            }

        if (user.length) {
            opt.username = user;
            if (pass.length) {
                opt.password = pass;
            }
        }

        var client  = mqtt.connect(opt)
        client.on('error', function (error) {
            console.log('Conn failed:', error)
        });

        $('#container').html(loadTemplate("devices-cont", null));
        client.on('message', function (topic, message) {
            if (!is_fetch) {
                return;
            }

            var data = decodePayload(message);
            if (typeof data.devices == "undefined") {
                return;
            }
            var devices = data.devices.map(normalizeDevice),
                filter = $('#mac-filter').val();

            if (filter.length && !(filter.length % 2)) {
                filter = filter.toUpperCase().match(/.{2}/g).join(' ');
                devices = devices.filter(function (d) {
                    return d.mac.indexOf(filter) === 0;
                });
            }

            data.cnt = devices.length;
            data.devices = devices;

            $('#cont-dev').prepend(loadTemplate('devices', data));
            if (filter.length) {
                $('#cont-dev a').trigger("click");
            }
            $('#cont-dev a:gt(15)').remove();
        })

        client.on('connect', function () {
            console.log("connected")
            client.subscribe(topic);
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
            loadFormData()
        });

        $('#cont-dev').on('click', 'a', function() {
            $('#cont-dev a').removeClass("active");
            $(this).addClass("active");
        });

    });
});
