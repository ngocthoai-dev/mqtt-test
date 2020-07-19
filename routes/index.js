const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require("cookie-parser");
const session = require("express-session");
const moment = require('moment');
const pdf = require('html-pdf');
const ejs = require('ejs');
const path = require('path');

// secured id
const hashing = require('../routes/custom_hashing');
const secid = require('../routes/custom_hashing').getSecId();
const dataInNex5Days = require('../routes/prediction').getDataInNext5Days;

// connect db
const db = require('../routes/dbConnection').db;

// middleware function to check for logged-in users
var sessionChecker = (req, res, next) => {
  if (!req.session.user || !req.signedCookies.secid) {
    res.redirect('/users/');
  } else {
    next();
  }
};


const mqtt = require('mqtt');
let mqttClient = mqtt.connect('mqtt:52.163.220.103:1883');
var msgAlert = require('../routes/msgAlert').checkInDangerTree;

// mqttClient.on('connect', function() {
//   mqttClient.subscribe('water', function(err, granted) {
//     console.log('connected');
//     if (!err) {
//       console.log(granted);
//     }
//   });
// });
//
// mqttClient.on('message', function (topic, message) {
//   // message is Buffer
//   console.log(topic);
//   console.log(message.toString());
// });

// routing section
let router = express.Router();

router.get('/sendMsg', function(req, res){
  console.log('sendMsg');
  msgAlert.sendMsg("guest121019@gmail.com", "tri.vo1999@hcmut.edu.vn", function(res){
    console.log(res);
  });
});

// testing intermission page
router.get('/intermission', sessionChecker, function(req, res){
  res.render('../views/intermission', { tree: { name: 'test' } });
});


// get private
// var os = require('os');
// var ifaces = os.networkInterfaces();
//
// Object.keys(ifaces).forEach(function (ifname) {
//   var alias = 0;
//   ifaces[ifname].forEach(function (iface) {
//     if ('IPv4' !== iface.family || iface.internal !== false) {
//       // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
//       return;
//     }
//
//     if (alias >= 1) {
//       // this single interface has multiple ipv4 addresses
//       console.log(ifname + ':' + alias, iface.address);
//     } else {
//       // this interface has only one ipv4 adress
//       console.log(ifname, iface.address);
//     }
//     ++alias;
//   });
// });

router.get(['/', '/home'], sessionChecker, function(req, res) {
  console.log('req from:' + req.url);
  db().collection('tree').find({
    user: req.signedCookies['secid'],
    isDeleted: false,
  }).toArray(function(err, treeLst){
    if(err) console.log(err);
    let trees = [], everyTreeWater="YES", lastWatering=new Date('01-01-2020');

    treeLst.forEach((tree) => {
      if(tree.water){
        Object.keys(tree.water).forEach((key)=>{
          if(new Date(key) < new Date()){
            everyTreeWater = "NO";
          }
          if(new Date(key) >= lastWatering){
            lastWatering = new Date(key + "T" + tree.water[key][0]);
          }
        });
      }
    });

    db().collection('tree').find({
      user: req.signedCookies['secid'],
    }).toArray(function(err, treeLst){
      if(err) console.log(err);

      treeLst.forEach((tree) => {
        trees.push(tree.name);
      });

      res.render('../views/index', { data: trees, everyTreeWater: everyTreeWater, lastWatering: lastWatering });
    });
  });
});

// filtering operation
router.post('/operation/filterTreeList', sessionChecker, function(req, res, next) {
  console.log('req from:' + req.url);
  let temperatureMinValue = req.body.data.TemperatureMinValue;
  let temperatureMaxValue = req.body.data.TemperatureMaxValue;
  let moistureMinValue = req.body.data.MoistureMinValue;
  let moistureMaxValue = req.body.data.MoistureMaxValue;
  let humidityMinValue = req.body.data.HumidityMinValue;
  let humidityMaxValue = req.body.data.HumidityMaxValue;

  if (temperatureMinValue == '')
    temperatureMinValue = Number.MIN_SAFE_INTEGER;
  if (temperatureMaxValue == '')
    temperatureMaxValue = Number.MAX_SAFE_INTEGER;
  if (moistureMinValue == '')
    moistureMinValue = Number.MIN_SAFE_INTEGER;
  if (moistureMaxValue == '')
    moistureMaxValue = Number.MAX_SAFE_INTEGER;
  if (humidityMinValue == '')
    humidityMinValue = Number.MIN_SAFE_INTEGER;
  if (humidityMaxValue == '')
    humidityMaxValue = Number.MAX_SAFE_INTEGER;

  // console.log(temperatureMinValue, temperatureMaxValue, moistureMinValue, moistureMaxValue, humidityMinValue, humidityMaxValue);

  db().collection('tree').find({
    name: { "$regex": req.body.data.TreeName, "$options": "i" },
    'currentData.temperature': { "$gte": parseInt(temperatureMinValue), "$lte": parseInt(temperatureMaxValue) },
    'currentData.moisture': { "$gte": parseFloat(moistureMinValue), "$lte": parseFloat(moistureMaxValue) },
    'currentData.humidity': { "$gte": parseInt(humidityMinValue), "$lte": parseInt(humidityMaxValue) },
    user: req.signedCookies['secid'],
  }).toArray(function(err, treeLst){
    if(err) throw err;

    let trees = [];
    treeLst.forEach((tree) => {
      trees.push(tree.name);
    });
    // console.log(trees);
    res.send(trees);
  });
});

// generate report
router.post('/generate-report', sessionChecker, function(req, res){
  console.log('report gen from req:', req.url);
  let test;
  db().collection('tree').find({
    user: req.signedCookies['secid'],
    name: req.body.tree.name,
  }).toArray(function(err, tree){
    if(err) throw err;

    // let data = {
    //   date: {
    //     water: [ time ],
    //     sensorData: [{
    //       time: ,
    //       temperature: ,
    //       moisture: ,
    //       humidity: ,
    //     }],
    //   },
    //   schedule: time,
    // };
    let data = {}, schedule, treeName=req.body.tree.name;
    tree.forEach((items, i)=>{
      let currentDay = new Date(new Date().toISOString().split("T")[0]);
      for(let i=0; i<7; i++){
        let yyyymmdd = currentDay.toISOString().split("T")[0].split('-');
        let day = yyyymmdd[2] + '/' + yyyymmdd[1] + '/' + yyyymmdd[0];
        let itemDay = yyyymmdd.join('-');

        data[day] = { water: [], sensorData: [], };
        schedule =  items.schedule;

        if(items.water.hasOwnProperty(itemDay)){
          data[day].water = items.water[itemDay];
        }

        items.data.forEach((item, i)=>{
          if(new Date(item.date.toISOString().split("T")[0]).getTime() == currentDay.getTime()){ // only ==, !=, ===, and !== require .getTime()
            let time = item.date.getUTCHours() + ':' + item.date.getUTCMinutes(), exist=false, idx=0;
            for(let i=0; i<data[day].sensorData.length && !exist; i++){
              if(data[day].sensorData[i].time == time){
                exist = true;
                idx=i;
              }
            }
            if(!exist){
              data[day].sensorData.push({
                time: time,
                temperature: item.temperature ? item.temperature : "N/A",
                moisture: item.moisture ? item.moisture : "N/A",
                humidity: item.humidity ? item.humidity : "N/A",
              });
            } else {
              data[day].sensorData[idx].temperature = item.temperature ? item.temperature : data[day].sensorData[idx].temperature;
              data[day].sensorData[idx].moisture = item.moisture ? item.moisture : data[day].sensorData[idx].moisture;
              data[day].sensorData[idx].humidity = item.humidity ? item.humidity : data[day].sensorData[idx].humidity;
            }
          }
        });

        if(data[day].water.length == 0){
          data[day].water.push('None');
        }

        if(data[day].sensorData.length == 0){
          data[day].sensorData.push({
            time: "N/A",
            temperature: "N/A",
            moisture: "N/A",
            humidity: "N/A",
          });
        }

        // console.log(currentDay);
        currentDay.setDate(currentDay.getDate() - 1);
        // console.log(data[day]);
      }
    });
    // console.log(data);
    ejs.renderFile(path.resolve(__dirname + "/Report_Template.ejs"), { tree: { name: treeName, data: data, schedule: schedule } }, (err, data) => {
      if (err) {
        console.log(err);
        res.send(err);
      } else {
        let options = {
          "height": "11.25in",
          "width": "8.5in",
          "header": {
            "height": "20mm"
          },
          "footer": {
            "height": "20mm",
          },
        };
        pdf.create(data, options).toFile(path.resolve(__dirname + "/../public/Report_" + treeName + ".pdf"), function (err, resp) {
          // console.log(resp);
          if (err) {
            res.send(err);
          } else {
            res.send("File created successfully");
          }
        });
      }
    });
    // res.send('suc');
  });
});

// get report
router.get('/fetch-report/:treeName', sessionChecker, function(req, res){
  console.log("fetch report:", req.url);
  // resolve for avoid malicious error
  res.sendFile(path.resolve(__dirname + "/../public/Report_" + req.params.treeName + ".pdf"));
});


// refresh page
router.post('/tree/refresh', sessionChecker, function(req, res){
  db().collection('tree').find({
    name: req.body.treeName,
    user: req.signedCookies['secid'],
  }).toArray(function(err, result){
    if(err) throw err;

    let temp=0, mois=0, humi=0, isWaterToday="NO", lastWater='None', sensors=[], isWatering=false;
    result.forEach((tree, i) => {
      temp = tree.currentData.temperature;
      mois = tree.currentData.moisture;
      humi = tree.currentData.humidity;
      sensors = tree.sensor;
      // console.log(tree.currentData);
      if(tree.motor.value){
        // console.log(tree.motor.value);
        if(tree.motor.value[0] == "1"){
          isWatering = true;
        }
      }
      if(tree.water && Object.keys(tree.water).length > 0){
        let length = Object.keys(tree.water).length - 1, newestDay = Object.keys(tree.water)[length];
        // console.log(newestDay);
        if(newestDay){
          isWaterToday = (new Date(newestDay).toISOString().split("T")[0] == new Date().toISOString().split("T")[0]) ? "YES" : "NO";
          lastWater =  tree.water[newestDay][0] + "T" + newestDay.split("-")[2] + "-" + newestDay.split("-")[1] + "-"  + newestDay.split("-")[0];
        }
      }
    });
    // console.log(sensors);
    // console.log(req.params.treeName, isWatering, lastWater);

    res.send({
      data: {
        temperature: temp, moisture: mois, humidity: humi,
        isWaterToday: isWaterToday, lastWater: lastWater,
        isWatering: isWatering,
      },
      status: 'changed',
    });
  });
});
// render tree page
router.get('/tree/:treeName', sessionChecker, function(req, res) {
  let treeName = req.params.treeName;
  db().collection('tree').find({
    name: treeName,
    user: req.signedCookies['secid'],
  }).toArray(function(err, result){
    if(err) throw err;

    let temp=0, mois=0, humi=0, isWaterToday="NO", lastWater='None', sensors=[], isWatering=false, isDeleted=false;
    result.forEach((tree, i) => {
      temp = tree.currentData.temperature;
      mois = tree.currentData.moisture;
      humi = tree.currentData.humidity;
      sensors = tree.sensor;
      isDeleted = tree.isDeleted;
      if(tree.motor.value){
        // console.log(tree.motor.value);
        if(tree.motor.value[0] == "1"){
          isWatering = true;
        }
      }
      if(tree.water && Object.keys(tree.water).length > 0){
        let length = Object.keys(tree.water).length - 1, newestDay = Object.keys(tree.water)[length];
        // console.log(newestDay);
        if(newestDay){
          isWaterToday = (new Date(newestDay).toISOString().split("T")[0] == new Date().toISOString().split("T")[0]) ? "YES" : "NO";
          lastWater =  tree.water[newestDay][0] + "T" + newestDay.split("-")[2] + "-" + newestDay.split("-")[1] + "-"  + newestDay.split("-")[0];
        }
      }
    });
    // console.log(sensors);
    // console.log(req.params.treeName, isWatering, lastWater);

    res.render('../views/tree', {
      tree: {
        name: treeName,
        temperature: temp, moisture: mois, humidity: humi,
        isWaterToday: isWaterToday, lastWater: lastWater,
        sensors: sensors,
        isWatering: isWatering,
        isDeleted: isDeleted,
        lvlPrediction: dataInNex5Days(),
      },
    });
  });
});

const publish_motor = require('../routes/mqtt_connection').publish_motor;
// get tree page submit
router.post('/tree/:treeName', sessionChecker, function(req, res) {
  console.log('post from tree:', req.url);
  let checkType=req.body.data.type;

  if(checkType.includes('schedule')){
    let today = new Date();
    // console.log(today.getFullYear(), '-', today.getMonth(), '-', today.getDate(), '-', req.body.data.hh, '-', req.body.data.mm, '-', 0);
    let treeName=req.params.treeName, freq=req.body.data.freq, waterLvl=req.body.data.waterLvl;
    let time = req.body.data.hh.padStart(2, "0") + ":" + req.body.data.mm.padStart(2, "0");
    if(waterLvl == '')
      waterLvl = 60;
    // console.log(time);
    // set schedule
    db().collection('tree').find({
      user: req.signedCookies['secid'],
      name: treeName,
    }).toArray((err, tree)=>{
      if(err) throw err;

      if(tree.length === 0){
        res.send({ data: { success: false, msg: "no tree found!"} });
      } else {
        if(tree[0].isDeleted){
          res.send({ data: { success: false, msg: "tree has been remove!"} });
          return;
        }
        db().collection('tree').findOneAndUpdate(
        { user: req.signedCookies['secid'], name: treeName, },
        { $set: {
            schedule: {
              frequency: parseInt(freq),
              time: time,
              level: parseInt(waterLvl),
            },
          },
        },
        { upsert: true, },
        function(err, re){
          if(err) throw err;

          res.send({ data: { success: true, msg: "schedule" } });
        });
      }
    });
    // res.send(req.body.data);
  } else if(checkType.includes('manual')) { // error may occur by schedule and manual
    // manual water
    let treeName=req.body.data.tree, flow=req.body.data.flow;

    // stop watering
    // console.log('stop');
      // watering
      db().collection('tree').find({
        user: req.signedCookies['secid'],
        name: treeName,
      }).toArray((err, trees)=>{
        if(err) throw err;

        console.log('water man');
        if(trees.length === 0){
          res.send({ data: { success: false, msg: "no tree found!"} });
        } else {
          if(trees[0].isDeleted){
            res.send({ data: { success: false, msg: "tree has been remove!"} });
            return;
          }
          var today = "water." + new Date().toISOString().split('T')[0], time=new Date().getHours().toString().padStart(2, "0") + ":" + new Date().getMinutes().toString().padStart(2, "0");

          if(checkType.includes('stop')){
            db().collection('tree').findOneAndUpdate({
              user: req.signedCookies['secid'],
              name: treeName,
            }, {
              $set: { isWatering: false, },
            }, { upsert: true, },
            function(err, result){
              if(err) throw err;

              // console.log(result);
              let data = [];
              data.push({
                "device_id": "Light_D",
                "values": ["0", "0"],
              });
              // console.log(data);
              publish_motor(result.value.motor.name, JSON.stringify(data));
              res.send({ data: { success: true } });
            });
          } else {
            db().collection('tree').findOneAndUpdate(
            { user: req.signedCookies['secid'], name: treeName, },
            {
              $push: { [today]: { $each: [time], $position: 0, } },
              $set: { isWatering: true },
            },
            { upsert: true, },
            function(err, re){
              if(err) throw err;

              let waterTimeout = setTimeout(()=>{
                // stop watering after flow sec
                db().collection('tree').find({
                  user: req.signedCookies['secid'],
                  name: treeName,
                }).toArray((err, trees)=>{
                  if(err) throw err;

                  trees.forEach((tree, i) => {
                    if(tree.isWatering == true){
                      db().collection('tree').findOneAndUpdate({
                        user: req.signedCookies['secid'],
                        name: treeName,
                      }, {
                        $set: { isWatering: false, },
                      }, { upsert: true, },
                      function(err, result){
                        if(err) throw err;

                        let data = [];
                        data.push({
                          "device_id": "Light_D",
                          "values": ["0", "0"],
                        });

                        publish_motor(result.value.motor.name, JSON.stringify(data));
                        // console.log(result);
                      });
                    }
                  });
                });
              }, 1000*flow);

              // console.log(re);
              let data = [], value="0";
              if(flow > 60*3){
                value = "255";
              } else if(flow > 60*1.5){
                value = "180";
              } else {
                value = "100";
              }
              data.push({
                "device_id": "Light_D",
                "values": ["1", value],
              });
              // console.log(data);
              publish_motor(re.value.motor.name, JSON.stringify(data));
              res.send({ data: { success: true, msg: "watering" } });
            });
          }
      }
    });
    // res.send({ success: false, msg: "no tree found!"});
  } else {
    res.send({ data: { success: false, msg: 'Incorrect Order!' } });
  }
});

// report to tree name
router.get('/report/:treeName', sessionChecker, function(req, res){
  console.log('get report:' + req.url);
  let now = new Date();
  db().collection('tree').find({
    user: req.signedCookies['secid'],
    name: req.params.treeName,
    data: { $elemMatch : {
      date: { $lte: now }
    } }
  }).toArray(function(err, result){
    if(err) throw err;
    let data = [];
    if(result.length > 0){
      let cnt = 0;
      let averageTemp=0, averageMois=0, averageHumi=0, cntTemp=0, cntHumi=0, cntMois=0, current=new Date(result[0].data[0].date.toISOString().split('T')[0]);
      for(const obj in result[0].data){
        let item = result[0].data[obj];
        if(cnt>7){
          break;
        }
        console.log(cnt, current);
        let itemDate = new Date(item.date.toISOString().split('T')[0]);
        if(itemDate < current){
          cnt++;
          data.push({
            date: current,
            averageTemp: parseInt(averageTemp/cntTemp),
            averageMois: parseFloat(averageMois/cntMois),
            averageHumi: parseInt(averageHumi/cntHumi),
          });
          current = itemDate;
          averageTemp = item.temperature ? item.temperature : 0;
          averageMois = item.moisture ? item.moisture : 0;
          averageHumi = item.humidity ? item.humidity : 0;
          cntTemp=0;
          cntHumi=0;
          cntMois=0;
        } else {
          averageTemp += item.temperature ? item.temperature : 0;
          averageMois += item.moisture ? item.moisture : 0;
          averageHumi += item.humidity ? item.humidity : 0;
        }
        if(item.temperature)
          cntTemp++;
        if(item.moisture)
          cntMois++;
        if(item.humidity)
          cntHumi++;
      }
      data.push({
        date: current,
        averageTemp: parseInt(averageTemp/cntTemp),
        averageMois: parseFloat(averageMois/cntMois),
        averageHumi: parseInt(averageHumi/cntHumi),
      });
    }

    console.log(data);
    res.render('../views/report', { tree: { name: req.params.treeName, data: data } });
  });
});

router.get('/addSensor', sessionChecker, function(req, res){
  db().collection('tree').find({
    user: req.signedCookies['secid'],
    isDeleted: false,
  }).toArray(function(err, treeLst){

    if(err) throw err;
    console.log('req add sensor:', req.url);
    let trees = [];
    treeLst.forEach((tree) => {
      trees.push(tree.name);
    });

    res.render('../views/addSensor', { data: trees });
  });
});

router.post('/deleteTree', sessionChecker, function(req, res){
  let treeName = req.body.treeName, user=req.body.user;
  let username = req.signedCookies['secid'].split('$')[0];
  let hashPass = hashing.hash(req.body.pass, { salt: username, rounds: 20 });
  db().collection('user').find({
    username: username,
    password: hashPass,
  }).toArray((err, users) => {
    if(err) throw err;

    if(users.length){
      db().collection('tree').find({
        user: req.signedCookies['secid'],
        name: treeName,
        isDeleted: true,
      }).toArray(function(err, re) {
        if(err) console.log (err);
        console.log(re, re.length);
        if(re.length){
          res.send({ success: false, msg: "Tree has been Deleted!" });
        }
        else {
          db().collection('tree').findOneAndUpdate({
            user: req.signedCookies['secid'],
            name: treeName,
          }, {
            $set: { isDeleted: true, },
          }, function(err, re) {
            if(err) throw err;
            console.log('req');
            res.send({ success: true });
          });
        }
      });
    } else {
      res.send({ success: false, msg: "incorrect password!" });
    }
  })
});


router.post('/addSensor', sessionChecker, function(req, res) {
  // console.log('post add sensor', req.url);
  // console.log(req.body.data);
  if(req.body.data.type.includes('update-tree')){
    let treeName=req.body.data.treeName, tempHumiName=req.body.data.tempHumi,
      moisName=req.body.data.moisture, motorName=req.body.data.motor, user=req.signedCookies['secid'];
    let sensor=[], today=new Date(), motor={};

    db().collection('tree').find({
      user: req.signedCookies['secid'],
      name: treeName,
      isDeleted: false,
    }).toArray((err, trees)=>{
      if(err) throw err;

      if(tempHumiName != ''){
        sensor.push({
          tempHumi: tempHumiName,
          date: today,
        });
      }
      if(moisName != ''){
        sensor.push({
          moisture: moisName,
          date: today,
        });
      }
      if(motorName != ''){
        motor.name = motorName;
        motor.date = today;
      }

      if(trees.length > 0){
        trees.forEach((tree, i) => {
          if(tempHumiName == ''){
            tree.sensor.forEach((item, i) => {
              if(Object.keys(item).includes('TempHumi')){
                sensor.push(item);
              }
            });
          }
          if(moisName == ''){
            tree.sensor.forEach((item, i) => {
              if(Object.keys(item).includes('Mois')){
                sensor.push(item);
              }
            });
          }
          if(motorName == ''){
            motor = tree.motor;
          }
        });

        db().collection('tree').findOneAndUpdate({
          user: req.signedCookies['secid'],
          name: treeName,
        }, {
          $set: {
            sensor: sensor,
            motor: motor,
          },
        }, { upsert: true },
        function(err, re){
          if(err) throw err;

          // console.log(re);
          res.send({ success: true, msg: 'update' });
        });
      } else {
        db().collection('tree').findOneAndUpdate({
          user: req.signedCookies['secid'],
          name: treeName,
        }, {
          $set: {
            name: treeName,
            data: [],
            schedule: {},
            water: {},
            sensor: sensor,
            motor: motor,
            user: [user],
            isWatering: false,
            currentData: {
              temperature: 0,
              moisture: 0,
              humidity: 0,
            },
            isDeleted: false,
          }
        }, { upsert: true },
        function(err, re){
          if(err) throw err;

          // console.log(re);
          res.send({ success: true, msg: 'add' });
        });
      }
    });
  } else {
    res.send({ success: false, msg: 'Incorrect order!' });
  }
});

router.post('/givePermission', sessionChecker, function(req, res){
  let treeName=req.body.treeName, user=req.body.user;
  db().collection('user').find({
    username: user,
  }).toArray((err, users)=>{
    if(err) throw err;

    if(users.length == 0){
      res.send({ success: false, msg: 'no user: ' + user + ' found!', });
    } else {
      db().collection('tree').findOneAndUpdate({
        user: req.signedCookies['secid'], name: treeName,
      }, {
        $addToSet: {
          user: hashing.hash(user, {salt: user, rounds: 20}),
        },
      }, { upsert: true },
      function(err, re) {
        if(err) throw err;
        console.log('req');
        res.send({ success: true });
      });
    }
  });
});


const checkEmail = require('../routes/checkEmail').checkEmail;

router.post('/addEmail', sessionChecker, function(req, res){
  let email=req.body.email, user=req.signedCookies['secid'].split('$')[0];

  if(checkEmail(email)){
    db().collection('user').findOneAndUpdate({
      username: user,
    }, {
      $set: {
        email: email,
      }
    }, {},
    function(err, re){
      if(err) throw err;

      res.send({ success: true });
    });
  } else {
    res.send({ success: false, msg: 'your email is not correct' });
  }
});

router.get('/logout', sessionChecker, function(req, res){
  req.session.destroy(err=>{
    if(err) throw err;

    res.clearCookie('secid');
    res.clearCookie('sec');
    res.redirect('/users/');
  });
});

module.exports = { router };
