<script>
  export let name;
  var ws; // Websocket
  // Default websocket address on non routable network
  var wsAddress = "ws://192.168.0.10:8080";
  $: {
    logger('Saving WS Address');
    localStorage.setItem('wsaddress',wsAddress);
    if (ws != undefined) ws.close();
    initWS();
  }
  let state = "";
  var readyState = 0;

  var msgQueue = [];
  var log = [];

  function logger(msg) {
    console.log(msg);
    if (log.length >= 50) {
      log.shift();
    }
    log = [...log, msg];
  }

  var usingCordova = false;

  if ("usingCordova" in window) {;

    usingCordova = true;
    logger('Using cordova');
  } else {
    // emulate cordova global variables
    logger('Not using cordova');
    //var device;
  }

  document.onvisibilitychange = function() {
      logger('on visibility change');
      initWS();
      sendKey("status");
  };

  if (usingCordova) {
    // Open websocket when running with PhoneGap
    logger('using cordova');
    document.addEventListener("deviceready", onDeviceReady, false);
    function onDeviceReady() {
      // Now safe to use device APIs
      logger('onDeviceReady');
      initWS();
    }
  } else {
    // Open websocket when running in a browser
    logger('not using cordova');
    onMount(async () => {
      initWS();
    });
  }

  function getWsAddress() {
    var address = localStorage.getItem('wsaddress');
    logger('Address from local storage = ' + address);
    if (address == null || address == "") {
      // First call, use the default websocket address
      localStorage.setItem('wsaddress',wsAddress);
    } else {
      // use the stored address
      wsAddress = address;
    }
    logger("WS Address = " + wsAddress);
  }

  function initWS() {
    logger('initWS');
    if (ws != undefined) {
      if (ws.readyState == 1) return;
      // Nothing to do if websocket is connected
    }

    logger('init WS called');
    // Web Socket
    if ("WebSocket" in window) {
      // alert("WebSocket is supported by your Browser!");
      // Let us open a web socket
      logger('Opening WS');
      getWsAddress();
      ws = new WebSocket(wsAddress)
      
      logger('Opening WS done');

      ws.onmessage = function(evt) {
        var received_msg = evt.data;
        logger("Message is received... : " + received_msg);
        logger('getting msg from  WS : ' + received_msg);

        state = received_msg;
      };
      ws.onclose = function(evt) {
        logger('Receiving close msg');
        logger('code : ' + evt.code);
        logger('reason : ' + evt.reason);
        readyState = ws.readyState;
        logger(evt.toString());
      };
      ws.onopen = function() {
        logger('WS Opened');
        readyState = ws.readyState;
        // Send all message from queue (if any)
        logger("Flushing queue. Nb of items : " + msgQueue.length);
        while (msgQueue.length > 0) {
          ws.send(msgQueue.pop());
        }
      };
    } else {
      // The browser doesn't support WebSocket
      alert("WebSocket NOT supported by your Browser!");
    }
  }

  function sendKey(key) {
    logger("sendKey called");
    initWS();
    logger("ws init called");
    if (ws.readyState != 1) {
      // Websocket not ready, push the msg in the queue to send it after
      logger("push key : " + key);
      msgQueue.push(key);
    } else {
      // Websocket is ready, we send the message right now
      logger("Direct send key : " + key);
      ws.send(key);
    }
  }

  import { onMount } from "svelte";

  import "smelte/src/tailwind.css";

  import AppBar from "smelte/src/components/AppBar";
  import Button from "smelte/src/components/Button";
  import List from "smelte/src/components/List";
  import ListItem from "smelte/src/components/List/ListItem.svelte";
  import NavigationDrawer from "smelte/src/components/NavigationDrawer";
  import Icon from "smelte/src/components/Icon";
  import ProgressCircular from "smelte/src/components/ProgressCircular";
  import { Spacer } from "smelte/src/components/Util";
  import { TextField } from "smelte";

  const menu = [
    { to: "remote", text: "Telecommande" },
    { to: "debug", text: "Debug" }
  ];

  // Drawer functions and variables

  let selectedPanel = "remote";
  function go(item) {
    selectedPanel = item;
    closeDrawer();
  }

  let showNav = false;
  let showNavOpenByButton = false;

  function openDrawer() {
    showNav = true;
    showNavOpenByButton = true;
  }

  function closeDrawer() {
    if (!showNavOpenByButton) return;
    showNav = false;
    showNavOpenByButton = false;
  }

  function myfunc(name) {
    var gaps = 'google.script.run.myfunc("' + name + '")';
    window[gaps](name);
  }
</script>

<style>
  .center {
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>

<AppBar class="bg-blue-400">
  <div class="md:hidden">
    <Button icon="menu" small flat color="white" text on:click={openDrawer} />
  </div>
  <h6 class="pl-3 text-white tracking-widest font-thin text-lg">
    {name}
    {#if state != ''}
      <span>- {state}</span>
    {/if}
  </h6>
  <Spacer />
  {#if readyState != 1}
    <div class="mr-10">
    <Button text light flat small icon="broken_image" color="error" block on:click={() => initWS()} ></Button>
    </div>
  {/if}
</AppBar>

<main
  class="container relative p-8 lg:max-w-5xl lg:ml-64 mx-auto mb-6 mt-10
  md:ml-64 md:max-w-md md:px-">

  <NavigationDrawer bind:show={showNav}>
    <List items={menu}>
      <span slot="item" let:item class="cursor-pointer">
        <a href="#!" on:click={go(item.to)}>
          <ListItem {...item} dense selected={selectedPanel == item.to} />
        </a>
      </span>
    </List>
    <hr />
  </NavigationDrawer>

  {#if selectedPanel == 'remote'}
    {#if state == ''}
      <div class="center">
        <ProgressCircular />
      </div>
    {:else if state == 'sleep'}
      <Button color="alert" add="mb-4" block on:click={() => sendKey('power')}>
        TV
      </Button>
      <Button color="alert" add="mb-4" block on:click={() => sendKey('green')}>
        Switch
      </Button>
      <Button color="alert" add="mb-4" block on:click={() => sendKey('blue')}>
        Radio
      </Button>
      <Button color="alert" add="mb-4" block on:click={() => sendKey('red')}>
        DVD
      </Button>
      <Button color="alert" add="mb-4" block on:click={() => sendKey('yellow')}>
        Mi Box
      </Button>
    {:else}
      <div class="flex mb-4 h-20">
        <div class="w-1/3 center h-12">
          <Button
            color="error"
            icon="tv_off"
            on:click={() => sendKey('power')} />
        </div>
        <div class="w-1/3 h-12" />
        <div class="w-1/3 center h-12">
          <Button
            color="success"
            icon="home"
            on:click={() => sendKey('home')} />
        </div>
      </div>
      <div class="flex mb-6 h-48 grid grid-rows-4 grid-flow-col gap-4">
        <div class="center">
          <Button color="gray" on:click={() => sendKey('1')}>1</Button>
        </div>
        <div class=" center">
          <Button color="gray" on:click={() => sendKey('4')}>4</Button>
        </div>
        <div class="center">
          <Button color="gray" on:click={() => sendKey('7')}>7</Button>
        </div>
        <div class="center" />
        <div class="center">
          <Button color="gray" on:click={() => sendKey('2')}>2</Button>
        </div>
        <div class="center">
          <Button color="gray" on:click={() => sendKey('5')}>5</Button>
        </div>
        <div class="center">
          <Button color="gray" on:click={() => sendKey('8')}>8</Button>
        </div>
        <div class="center">
          <Button color="gray" on:click={() => sendKey('0')}>0</Button>
        </div>
        <div class="center">
          <Button color="gray" on:click={() => sendKey('3')}>3</Button>
        </div>
        <div class="center">
          <Button color="gray" on:click={() => sendKey('6')}>6</Button>
        </div>
        <div class="center">
          <Button color="gray" on:click={() => sendKey('9')}>9</Button>
        </div>
        <div class="center" />
        <div class="center">
          <Button color="error" on:click={() => sendKey('red')} />
        </div>
        <div class="center">
          <Button color="success" on:click={() => sendKey('green')} />
        </div>
        <div class="center">
          <Button color="alert" on:click={() => sendKey('yellow')} />
        </div>
        <div class="center">
          <Button color="blue" on:click={() => sendKey('blue')} />
        </div>
      </div>

      <div class="mb-4">
        <hr />
      </div>
      <div class="h-36 mb-6 grid grid-rows-3 grid-flow-col gap-4">
        <div class="center">
          <Button icon="volume_up" on:click={() => sendKey('vol_inc')} />
        </div>
        <div class="center" />
        <div class="center">
          <Button icon="volume_down" on:click={() => sendKey('vol_dec')} />
        </div>
        <div />
        <div class="center">
          <Button small icon="chevron_left" on:click={() => sendKey('left')} />
        </div>
        <div />
        <div class="center">
          <Button small icon="expand_less" on:click={() => sendKey('up')} />
        </div>
        <div class="center">
          <Button
            small
            icon="trip_origin"
            color="blue"
            on:click={() => sendKey('ok')} />
        </div>
        <div class="center">
          <Button small icon="expand_more" on:click={() => sendKey('down')} />
        </div>
        <div />
        <div class="center">
          <Button
            small
            icon="chevron_right"
            on:click={() => sendKey('right')} />
        </div>
        <div />
        <div class="center">
          <Button icon="add_to_queue" on:click={() => sendKey('prgm_inc')} />
        </div>
        <div class="center" />
        <div class="center">
          <Button
            icon="remove_from_queue"
            on:click={() => sendKey('prgm_dec')} />
        </div>
      </div>
      <div class="mb-4">
        <hr />
      </div>
      <div class="mb-6 h-36 grid grid-rows-3 grid-flow-col gap-4">
        <div class="center">
          <Button small icon="stop" on:click={() => sendKey('stop')} />
        </div>
        <div class="center">
          <Button small icon="fast_rewind" on:click={() => sendKey('bwd')} />
        </div>
        <div class="center">
          <Button small icon="skip_previous" on:click={() => sendKey('prev')} />
        </div>
        <div />
        <div class="center">
          <Button
            small
            icon="play_circle_outline"
            on:click={() => sendKey('play')} />
        </div>
        <div />
        <div class="center">
          <Button
            small
            icon="fiber_manual_record"
            color="error"
            on:click={() => sendKey('rec')} />
        </div>
        <div class="center">
          <Button small icon="fast_forward" on:click={() => sendKey('fwd')} />
        </div>
        <div class="center">
          <Button small icon="skip_next" on:click={() => sendKey('next')} />
        </div>
      </div>

      <div class="mb-4">
        <hr />
      </div>

    {/if}

      {#if state == 'sleep'}
        <div>Tous les équipements devraient être éteints</div>
        <br />
        <Button add="mb-4" block on:click={() => sendKey('tvOff')}>
          La télévision est allumée
        </Button>
        <Button add="mb-4" block on:click={() => sendKey('hcOnOff')}>
          Le home cinema est allumé
        </Button>
        <Button add="mb-4" block on:click={() => sendKey('fbOnOff')}>
          La freebox est allumée
        </Button>
      {/if}

    {#if state == 'TV'}
      <div>Tous les équipements devraient être allumés</div>
      <br />
      <Button add="mb-4" block on:click={() => sendKey('tvOnHdmi1')}>
        La télévision est eteinte
      </Button>
      <Button add="mb-4" block on:click={() => sendKey('hcOn15')}>
        Le home cinema est éteint
      </Button>
      <Button add="mb-4" block on:click={() => sendKey('hcSource')}>
        Le home cinema n'est pas sur la bonne source
      </Button>
      <Button add="mb-4" block on:click={() => sendKey('fbOnOff')}>
        La freebox est éteinte
      </Button>
      <Button add="mb-4" block on:click={() => sendKey('fbVol32')}>
        Le niveau sonore est faible
      </Button>
    {/if}

    {#if state == 'Switch'}
      <Button add="mb-4" block on:click={() => sendKey('tvOnHdmi3')}>
        La télévision est eteinte
      </Button>
      <Button add="mb-4" block on:click={() => sendKey('hcOn15')}>
        Le home cinema est éteint
      </Button>
      <Button add="mb-4" block on:click={() => sendKey('hcSource')}>
        Le home cinema n'est pas sur la bonne source
      </Button>
      <Button add="mb-4" block on:click={() => sendKey('fbOnOff')}>
        La freebox est allumée
      </Button>
    {/if}

    {#if state == 'Radio'}
      <Button add="mb-4" block on:click={() => sendKey('tvOff')}>
        La télévision est allumée
      </Button>
      <Button add="mb-4" block on:click={() => sendKey('hcOn15')}>
        Le home cinema est éteint
      </Button>
      <Button add="mb-4" block on:click={() => sendKey('hcSource')}>
        Le home cinema n'est pas sur la bonne source
      </Button>
      <Button add="mb-4" block on:click={() => sendKey('fbOnOff')}>
        La freebox est allumée
      </Button>
    {/if}

    {#if state == 'DVD'}
      <Button add="mb-4" block on:click={() => sendKey('tvOnHdmi2')}>
        La télévision est eteinte
      </Button>
      <Button add="mb-4" block on:click={() => sendKey('hcOn15')}>
        Le home cinema est éteint
      </Button>
      <Button add="mb-4" block on:click={() => sendKey('hcSource')}>
        Le home cinema n'est pas sur la bonne source
      </Button>
      <Button add="mb-4" block on:click={() => sendKey('fbOnOff')}>
        La freebox est allumée
      </Button>
    {/if}

    {#if state == 'Mi Box'}
      <Button add="mb-4" block on:click={() => sendKey('tvOnHdmi4')}>
        La télévision est eteinte
      </Button>
      <Button add="mb-4" block on:click={() => sendKey('hcOn15')}>
        Le home cinema est éteint
      </Button>
      <Button add="mb-4" block on:click={() => sendKey('hcSource')}>
        Le home cinema n'est pas sur la bonne source
      </Button>
      <Button add="mb-4" block on:click={() => sendKey('fbOnOff')}>
        La freebox est allumée
      </Button>
    {/if}
  {/if}

  {#if selectedPanel == 'debug'}
    {#if usingCordova}
      <p><b>Device info</b><br />
      Device cordova : {device.cordova}<br />
      Device model: {device.model}<br />
      Device platform : {device.platform}<br />
      Device uuid : {device.uuid}<br />
      Device version : {device.version}<br />
      Device manufacturer : {device.manufacturer}<br />
      Device isVirtual : {device.isVirtual}<br />
      Device serial : {device.serial}<br />
    </p>
    {/if}
    <TextField label="Websocket server" bind:value={wsAddress}></TextField>
    <Button on:click={() => { navigator.vibrate(500) ; alert(ws.readyState)}}>WS Status</Button>
    <p>WS readyState : {ws.readyState}</p>
    <p>Item in queue : {msgQueue.length}</p>
    <p><b>Request log :</b><br />
      {@html log.map( (item) => item.toString() + '<br />')}
    </p>

  {/if}
</main>
