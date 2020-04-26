'use strict';

// Generic function and global variables
module.paths.push('/usr/local/lib/node_modules');
var fs = require('fs');
var http = require('http');
var url = require('url');
var events = require('events');
var basedir = "/home/pi";
var basedirwww = basedir + "/www";

// Cache and queue variables
var globalqueue = [];
var cache = {};

// Broadlink global variable
let broadlink = require('broadlinkjs-rm');
var b = new broadlink();
var bdevice;

// Equipment current state
var state = "sleep"

function log(data) {
  console.log(data);
}

function hexToString(str) {
  const buf = new Buffer(str, 'hex');
  return buf.toString('utf8');
}

// Cache broadlink commands
function initCache() {
  var eventEmitter = new events.EventEmitter();

  fs.readdir(basedir + '/codes', function (err, files) {
    var toDo = files.length;
    files.forEach(function (file) {
      // Read each file and put in cache
      fs.readFile(basedir + '/codes/' + file, function (err, data) {
        if (err) {
          log('Error while trying to read file ' + file);
        } else {
          cache[file] = data;
          toDo--;
          if (toDo == 0) {
            log('Files put into cache');
            eventEmitter.emit('cacheReady');
          }
        }
      });
    });
  });
  return eventEmitter;
}

var cacheWorker = initCache();
cacheWorker.on('cacheReady', function () {
  // Now, cache is ready, lets discover the broadlink device
  console.log('Discovering broadlink');
  b.discover();
});

// Broadlink mgt
b.on("deviceReady", (dev) => {
  log('device ready ' + dev.type.toString() + ' ' + dev.host.toString() + ' ' + dev.mac.toString() + ' ' + dev.model.toString());
  bdevice = dev;

  // We create the HTTP server and WS server only if the broadlink device has been discovered and is ready
  createHTTPServer();
  createWSServer();
});

// Send order form a given queue to freebox or broadlink device
function SendData(queue) {
  log('Sending data : ' + queue.length);
  if (queue.length > 0) {
    var order = queue.shift();
    if (order.device == "RM") {
      // Sending to broadlink
      var bquery = bdevice.sendData(Buffer(order.data.toString(), 'hex'));
      log('Sending ' + Buffer(order.data, 'hex').toString() + ' to RM ');
    }
    if (order.device == "Free") {
      // Sending to freebox
      var url = "http://hd1.freebox.fr/pub/remote_control?code=5053012&key=" + order.key;
      if (order.longpress) {
        url = url + "&long=true"
      }
      log('Sending ' + url);
      var httpquery = http.get(url);
      httpquery.on('error', function (err) {
        // Handle error
        log('http error : ' + err)
      });
    }

    setTimeout(function () { SendData(queue) }, order.sleep);
  }
}
function PushRMProCommand(queue, command, repeat = 1, sleep = 0) {
  var order = { device: 'RM', data: cache[command + ".txt"], sleep: sleep };
  var index = repeat;
  while (index >= 1) {
    queue.push(order);
    index--;
  }
}

function PushFreeCommand(queue, key, repeat = 1, sleep = 0, longpress = false) {
  var order = { device: 'Free', key: key, sleep: sleep, longpress: longpress };
  var index = repeat;
  while (index >= 1) {
    queue.push(order);
    index--;
  }
}

function PushWait(queue, sleep = 0) {
  var order = { device: 'none', sleep: sleep };
  queue.push(order);
  log('Putting in queue wait : ' + sleep);
}

function On(newstate, bTv, bHc, bFb, sTVSource = null, lSoundLvl = 0, lHcInput = 0) {
  if (newstate) {
    state = newstate;
  }
  if (bTv) {
    PushRMProCommand(globalqueue, "tvOn", 2, 200);
    if (sTVSource) {
      PushWait(globalqueue, 10000);
      PushRMProCommand(globalqueue, sTVSource, 2, 200);
    }
  }
  if (bHc) {
    PushRMProCommand(globalqueue, "hcOnOff", 2, 200);
    PushWait(globalqueue, 5000); // Wait for Rs
    // Reduce volume
    PushRMProCommand(globalqueue, "hcVolDown", 35, 400);
    PushWait(globalqueue, 1000);
    if (lSoundLvl > 0) {
      PushRMProCommand(globalqueue, "hcVolUp", lSoundLvl, 400);
    }
    if (lHcInput > 0) {
      PushWait(globalqueue, 2000);
      PushRMProCommand(globalqueue, "hcSource", lHcInput, 2000);
    }
  }
  if (bFb) {
    PushFreeCommand(globalqueue, "power", 1, 0, false);
    PushWait(globalqueue, 5000, null);
  }
  SendData(globalqueue);
}

function Off(newstate, bTv, bHc, bFb, lHcInput = 0) {
  state = newstate;
  if (bTv) {
    PushRMProCommand(globalqueue, "tvOff", 2, 200);
  }
  if (bHc) {
    PushRMProCommand(globalqueue, "hcVolDown", 35, 400);
    PushWait(globalqueue, 1000);
    if (lHcInput > 0) {
      PushWait(globalqueue, 2000);
      PushRMProCommand(globalqueue, "hcSource", lHcInput, 2000);
    }
    PushWait(globalqueue, 1000);
    PushRMProCommand(globalqueue, "hcOnOff", 2, 200);
  }
  if (bFb) {
    PushFreeCommand(globalqueue, "power", 1, 0, false);
  }
  SendData(globalqueue);
}


// Websocket server on port 8080
function createWSServer() {
  var port = 8080,
    WebSocketServer = require('ws').Server,
    wss = new WebSocketServer({ port: port });

  log('Websocket server listening on port: ' + port);
  wss.on('connection', function connection(ws) {
    ws.on('message', function (message) {
      log('Message received: ' + message);
      processMessage(message);
      ws.send(state);
    });

    log('new client connected!');
    ws.send(state);
  });
}


// http server only rendering one html file
function createHTTPServer() {
  var server = http.createServer(function (req, res) {
    var url_parts = url.parse(req.url);
    log('Web page requested');
    req.params = params(req);
    if (typeof req.params.key !== 'undefined') {
      processMessage(req.params.key, req.params);
      res.writeHead(200);
      res.end('');
    } else {
      // We server a file
      var file = basedirwww;
      if (url_parts.pathname == "/") {
        file = file + "/index.html";
      } else {
        file = file + url_parts.pathname;
      }
      log('File : ' + file);
      fs.readFile(file, function (err, data) {
        if (err) {
          log('Error while trying to serve Web page');
          console.log('File : ' + file);
          res.writeHead(404,  {'Content-Type': 'text/html'});
          res.end();
        } else {
          log('Web page served');
          var filetype = file.substring(file.length - 3, file.length);
          switch (filetype) {
            case 'css':
              res.writeHead(200, { 'Content-Type': 'text/css' });
              break;
            case 'png':
              res.writeHead(200, { 'Content-Type': 'image/png' });
              break;
            default:
              res.writeHead(200, { 'Content-Type': 'text/html' });
          }
          res.end(data);
        }
      });
    }
  });
  server.listen(8010);
  log('Web server listening on port 8010');
}

var params = function (req) {
  let q = req.url.split('?'), result = {};
  if (q.length >= 2) {
    q[1].split('&').forEach((item) => {
      try {
        result[item.split('=')[0]] = item.split('=')[1];
      } catch (e) {
        result[item.split('=')[0]] = '';
      }
    })
  }
  return result;
}

function processMessage(message, params = null) {
  switch (message) {
    case "power":
      switch (state) {
        case "sleep":
          On("TV", true, true, true, "tvInputHdmi1", 15); break;
        case "TV":
          Off("sleep", true, true, true);
          //PushWait(globalqueue,20000);
          //PushRMProCommand(globalqueue,"peSalonOff", 0, 60000);
          SendData(globalqueue);
          break;
        case "Radio":
          Off("sleep", false, true, false, 2);
          //PushWait(globalqueue,20000);
          //PushRMProCommand(globalqueue,"peSalonOff", 0, 60000);
          SendData(globalqueue);
          break;
        case "Wii":
        case "Switch":
        case "Mi Box":
          Off("sleep", true, true, false);
          //PushWait(globalqueue,20000);
          //PushRMProCommand(globalqueue,"peSalonOff", 0, 60000);
          SendData(globalqueue);
          break;
      }
      break;
    case "yellow":
      switch (state) {
        case "sleep":
          On("Mi Box", true, true, false, "tvInputHdmi4", 35);
          break;
        case "TV":
          PushFreeCommand(globalqueue, message, 1, 0, false);
          SendData(globalqueue);
          break;
        default:
          // do nothing
          break;
      }
      break;
    case "green":
      switch (state) {
        case "sleep":
          On("Switch", true, true, false, "tvInputHdmi3", 15);
          break;
        case "TV":
          PushFreeCommand(globalqueue, message, 1, 0, false);
          SendData(globalqueue);
          break;
        default:
          // do nothing
          break;
      }
      break;
    case "red":
      switch (state) {
        case "sleep":
          On("DVD", true, true, false, "tvInputHdmi2", 15);
          break;
        case "TV":
          PushFreeCommand(globalqueue, message, 1, 0, false);
          SendData(globalqueue);
          break;
        default:
          // do nothing
          break;
      }
      // volume 15
      break;
    case "blue":
      switch (state) {
        case "sleep":
          On("Radio", false, true, false, null, 15, 3);
          break;
        case "TV":
          PushFreeCommand(globalqueue, message, 1, 0, false);
          SendData(globalqueue);
          break;
        default:
          // do nothing
          break;
      }
      break;
    case "vol_inc":
      PushRMProCommand(globalqueue, "hcVolUp", 1, 0);
      SendData(globalqueue);
      break;
    case "vol_dec":
      PushRMProCommand(globalqueue, "hcVolDown", 1, 0);
      SendData(globalqueue);
      break;
    case "tvOn":
      PushRMProCommand(globalqueue, "tvOn", 1, 0);
      SendData(globalqueue);
      break;
    case "tvOnHdmi1":
      On(null, true, false, false, "tvInputHdmi1");
      break;
    case "tvOnHdmi2":
      On(null, true, false, false, "tvInputHdmi2");
      break;
    case "tvOnHdmi3":
      On(null, true, false, false, "tvInputHdmi3");
      break;
    case "tvOnHdmi4":
      On(null, true, false, false, "tvInputHdmi4");
      break;
    case "tvOff":
      PushRMProCommand(globalqueue, "tvOff", 1, 0);
      SendData(globalqueue);
      break;
    case "hcSource":
      PushRMProCommand(globalqueue, "hcSource", 1, 0);
      SendData(globalqueue);
      break;
    case "hcOnOff":
      PushRMProCommand(globalqueue, "hcOnOff", 1, 0);
      SendData(globalqueue);
      break;
    case "hcOn15":
      // function On(newstate, bTv, bHc, bFb, sTVSource = null, lSoundLvl = 0, lHcInput = 0) {
      On(null, false, true, false, null, 15);
      break;
    case "hcOn15":
      // function On(newstate, bTv, bHc, bFb, sTVSource = null, lSoundLvl = 0, lHcInput = 0) {
      On(null, false, true, false, null, 35);
      break;
    case "fbOnOff":
      PushFreeCommand(globalqueue, "power", 1, 0, false);
      SendData(globalqueue);
      break;
    case "fbVol32":
      PushFreeCommand(globalqueue, "vol_inc", 32);
      SendData(globalqueue);
      break;
    case "state":
      log('setting state from #' + state + '# to #' + params.state + '#');
      log(params);
      state = params.state;
      break;
    default:
      if (state == "TV") {
        // by default, we send data to the freebox
        PushFreeCommand(globalqueue, message, 1, 0, false);
        SendData(globalqueue);
      }
      break;
  }
}
