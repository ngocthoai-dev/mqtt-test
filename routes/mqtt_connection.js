// connect db
const db = require('../routes/dbConnection').db;

const mqtt = require('mqtt');
let mqttClient = mqtt.connect('mqtt:52.163.220.103:1883');

function mqttConnection(){
  // mqtt connection
  mqttClient.on('connect', function() {
    db().collection('tree').find({

    }).toArray((err, trees)=>{
      if(err) throw err;

      trees.forEach((tree, i) => {
        if(tree.sensor.length > 0){
          tree.sensor.forEach((sensor, i)=>{
            mqttClient.subscribe(sensor, function(err, granted) {
              console.log('mqtt connect: ' + sensor);
              if (!err) {
                console.log(granted);
              }
            });
          });
        }
      });
    });
  });

  // mqtt message
  mqttClient.on('message', function(topic, message) {
    // message is Buffer
    console.log(topic);
    console.log(message.toString());
    let type=topic.split('_')[1], value=parseFloat(message);
    if(type.localeCompare('moisture')){
      value = parseInt(value);
    }
    db().collection('tree').findManyAndUpdate({
      sensor: topic,
    }, {
      $push: {
        data: {
          $each: [{
            date: new Date(),
            [type]: value,
          }],
          $position: 0,
        },
      },
      $set: {
        currentData: {
          [type]: value,
        },
      },
    });
  });
}

module.exports = { mqttConnection };
