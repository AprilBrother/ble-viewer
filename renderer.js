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

    function toFormatHex(data) {
        var newString  = data.toString('hex').toUpperCase().match(/.{2}/g).join(' ');
        return newString;
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

            var data = msgpack.decode(message);
            if (typeof data.devices == "undefined") {
                return;
            }
            data.cnt = data.devices.length;

            var t, filter = $('#mac-filter').val();
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
            } else {
                //data.devices.splice(20);
                for(var i = 0; i < data.devices.length; i++) {
                    data.devices[i] = toFormatHex(data.devices[i]);
                }
            }

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
