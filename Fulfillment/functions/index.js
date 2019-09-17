'use strict';

const functions = require('firebase-functions');
const {smarthome} = require('actions-on-google');
const util = require('util');
const admin = require('firebase-admin');
// Initialize Firebase
admin.initializeApp();
const firebaseRef = admin.database().ref('/');

exports.fakeauth = functions.https.onRequest((request, response) => {
  const responseurl = util.format('%s?code=%s&state=%s',
    decodeURIComponent(request.query.redirect_uri), 'xxxxxx',
    request.query.state);
  console.log(responseurl);
  return response.redirect(responseurl);
});

exports.faketoken = functions.https.onRequest((request, response) => {
  const grantType = request.query.grant_type
    ? request.query.grant_type : request.body.grant_type;
  const secondsInDay = 86400; // 60 * 60 * 24
  const HTTP_STATUS_OK = 200;
  console.log(`Grant type ${grantType}`);

  let obj;
  if (grantType === 'authorization_code') {
    obj = {
      token_type: 'bearer',
      access_token: '123access',
      refresh_token: '123refresh',
      expires_in: secondsInDay,
    };
  } else if (grantType === 'refresh_token') {
    obj = {
      token_type: 'bearer',
      access_token: '123access',
      expires_in: secondsInDay,
    };
  }
  response.status(HTTP_STATUS_OK)
    .json(obj);
});

const app = smarthome({
  debug: true,
});

app.onSync((body) => {
  return {
    requestId: body.requestId,
    payload: {
      agentUserId: '123',
      devices: [{
        id: 'smartlight',
        type: 'action.devices.types.LIGHT',
        traits: [
          'action.devices.traits.OnOff',
          'action.devices.traits.Brightness',
          'action.devices.traits.ColorSetting'
        ],
        name: {
          defaultNames: ['TAPIT Smart Lighting'],
          name: 'smart light',
          nicknames: ['tapit light']
        },
        willReportState: false,
        attributes: {
          colorModel: 'rgb'
        },
        deviceInfo: {
          manufacturer: 'TAPIT',
          model: 'hg11',
          hwVersion: '1.2',
          swVersion: '5.4'
        },
        customData: {
          fooValue: 12,
          barValue: false,
          bazValue: 'dancing alpaca'
        }
      }]
    }
  };
});

const queryFirebase = (deviceId) => firebaseRef.child(deviceId).once('value')
  .then((snapshot) => {
    const snapshotVal = snapshot.val();
    return {
      on: snapshotVal.OnOff.on,
      brightness: snapshotVal.Brightness,
      color: snapshotVal.Color.spectrumRGB,
    };
  });

// eslint-disable-next-line
const queryDevice = (deviceId) => queryFirebase(deviceId).then((data) => ({
  online: true,
  on: data.on,
  brightness: data.brightness,
  spectrumRGB: data.color,  
}));

app.onQuery((body) => {
  // TODO: Implement QUERY response
  const {requestId} = body;
  const payload = {
    devices: {},
  };
  const queryPromises = [];
  for (const input of body.inputs) {
    for (const device of input.payload.devices) {
      const deviceId = device.id;
      queryPromises.push(queryDevice(deviceId)
        .then((data) => {
          // Add response to device payload
          payload.devices[deviceId] = data;          
        }
        ));
    }
  }
  // Wait for all promises to resolve
  return Promise.all(queryPromises).then((values) => ({
    requestId: requestId,
    payload: payload,
  })
  );  
});

app.onExecute((body) => {
  // TODO: Implement EXECUTE response
  const {requestId} = body;
  const payload = {
    commands: [{
      ids: [],
      status: 'SUCCESS',
      states: {
        online: true,
      },
    }],
  };
  for (const input of body.inputs) {
    for (const command of input.payload.commands) {
      for (const device of command.devices) {
        const deviceId = device.id;
        payload.commands[0].ids.push(deviceId);
        for (const execution of command.execution) {
          const execCommand = execution.command;
          const {params} = execution;
          switch (execCommand) {
            case 'action.devices.commands.OnOff':
              firebaseRef.child(deviceId).child('OnOff').update({
                on: params.on,
              });
              payload.commands[0].states.on = params.on;
              break;
            case 'action.devices.commands.BrightnessAbsolute':
              firebaseRef.child(deviceId).update({
                Brightness: params.brightness,
              });
              payload.commands[0].states.brightness = params.brightness;
              break;
            case 'action.devices.commands.ColorAbsolute':
              firebaseRef.child(deviceId).child('Color').update({
                name: params.color.name,
                spectrumRGB: params.color.spectrumRGB,
              });
              payload.commands[0].states.color = {spectrumRgb: params.color.spectrumRGB};
              break;
          }
        }
      }
    }
  }
  return {
    requestId: requestId,
    payload: payload,
  };
});

exports.smarthome = functions.https.onRequest(app);