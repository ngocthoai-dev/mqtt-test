// connect db
const db = require('../routes/dbConnection').db;

const mqtt = require('mqtt');
let mqttClient = mqtt.connect('mqtt:52.187.125.59:1883');

mqttClient.on('connect', function() {
  console.log('mqtt connect!');
});

function mqttConnection(){
  // mqtt connection
  function connection(){
    db().collection('tree').find({

    }).toArray((err, trees)=>{
      if(err) throw err;

      trees.forEach((tree, i) => {
        if(tree.sensor.length > 0){
          tree.sensor.forEach((sensor, i)=>{
            Object.keys(sensor).forEach((sensorTopic, i) => {
              if(['TempHumi', 'Moisture'].includes(sensorTopic)){
                mqttClient.subscribe(sensor[sensorTopic], function(err, granted) {
                  console.log('mqtt connect: ' + sensor[sensorTopic]);
                  if (!err) {
                    // console.log(granted);
                  }
                });
              }
            });
          });
        }
        if(tree.motor.name){
          mqttClient.subscribe(tree.motor.name, function(err, granted){
            console.log('mqtt connect: ' + tree.motor.name);
            if(!err){

            }
          });
        }
      });
    });
  }

  connection();
  setInterval(connection, 1000*60);

  // mqtt message
  const sendMsg = require('../routes/msgAlert').sendMsg;
  mqttClient.on('message', function(topic, message){
    // message is Buffer
    // console.log(topic);
    // console.log(message.toString());
    let json = JSON.parse(message.toString());
    console.log('msg from:', JSON.stringify(json));
    // console.log(json);
    if(message.toString()[0] != '['){
      return;
    }

    let type=topic.split('/')[1], infoList=[];
    json.forEach((item, i) => {
      infoList.push(item);
    });

    // console.log(value);
    if(!type){
      console.log('error');
    } else {
      infoList.forEach((item, i) =>{
        if(item.device_id.includes('TempHumi')){
          // console.log('go');
          let sensorTempHumi='sensor.TempHumi', currentDataTemp='currentData.temperature', currentDataHumi='currentData.humidity';
          let valueTemp=parseInt(item.values[0]), valueHumi=parseInt(item.values[1]);

          db().collection('tree').updateMany({
            [sensorTempHumi]: topic,
          }, {
            $push: {
              data: {
                $each: [{
                  date: new Date(),
                  'temperature': valueTemp,
                }, {
                  date: new Date(),
                  'humidity': valueHumi,
                }],
                $position: 0,
              },
            },
            $set: {
              [currentDataTemp]: valueTemp,
              [currentDataHumi]: valueHumi,
            },
          }, { upsert: true },
          function(err, re){
            if(err) throw err;

            if(valueTemp > 40 || valueTemp < -20 || valueHumi > 100 || valueHumi < 0){
              db().collection('tree').find({
                [sensorTempHumi]: topic,
              }).toArray((err, trees)=>{
                trees.forEach((tree, i) => {
                  tree.user.forEach((user, i) => {
                    db().collection('user').findOne({
                      username: user.split('$')[0],
                    }, (err, user)=>{
                      if(err) throw err;

                      if(user.email){
                        sendMsg('guest121019@gmail.com', user.email, function(msg){
                          // console.log(msg);
                        }, 'WARNING: ' + tree.name + '!',
                        ('Dear ' + user.username + ',<br/><br/>' +
                        'the ' + tree.name + ' tree with the temperature: <b>' + valueTemp + '</b>;' + 'the humidity: <b>' + valueHumi + '</b>;<br/><br/>' +
                        'Thanks for using our app,<br/>Sincerely,<br/>mqtt-test.'));
                      }
                    });
                  });
                });
              });
            }
          });
        } else if(item.device_id.includes('Mois')){
          let sensorMois='sensor.Moisture', currentDataMois='currentData.moisture';
          let valueMois=parseFloat(item.values[0]);

          db().collection('tree').updateMany({
            [sensorMois]: topic,
          }, {
            $push: {
              data: {
                $each: [{
                  date: new Date(),
                  'moisture': valueMois,
                }],
                $position: 0,
              },
            },
            $set: {
              [currentDataMois]: valueMois,
            },
          }, { upsert: true },
          function(err, re){
            if(err) throw err;

            if(valueMois > 50 || valueMois < -20){
              db().collection('tree').find({
                [sensorMois]: topic,
              }).toArray((err, trees)=>{
                trees.forEach((tree, i) => {
                  tree.user.forEach((user, i) => {
                    db().collection('user').findOne({
                      username: user.split('$')[0],
                    }, (err, user)=>{
                      if(err) throw err;

                      if(user.email){
                        sendMsg('guest121019@gmail.com', user.email, function(msg){
                          // console.log(msg);
                        }, 'WARNING: ' + tree.name + '!',
                        ('Dear ' + user.username + ',<br/><br/>' +
                        'the ' + tree.name + ' tree with the moisture: <b>' + valueMois + '</b>;<br/><br/>' +
                        'Thanks for using our app,<br/>Sincerely,<br/>mqtt-test.'));
                      }
                    });
                  });
                });
              });
            }
          });
        } else if(item.device_id.includes(type)){
          let sensorLight='motor.name', dataLight=item.values;

          // console.log(dataLight);
          db().collection('tree').updateMany({
            [sensorLight]: topic,
          }, {
            $set: {
              'motor.date': new Date(),
              'motor.value': dataLight,
            },
          }, { upsert: true },
          function(err, re){
            if(err) throw err;
          });
        }
      });
    }
  });
}

function publish_motor(motorName, msg){
  // console.log('watering on:', msg);
  // console.log('watering on:', JSON.parse(JSON.stringify(msg)));
  mqttClient.publish(motorName, JSON.parse(JSON.stringify(msg)));
}

module.exports = { mqttConnection, publish_motor };
