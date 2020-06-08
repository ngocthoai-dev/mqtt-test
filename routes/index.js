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

const schedule = require('../routes/schedule');

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

// routing section
let router = express.Router();


const msgAlert = require('../routes/msgAlert');
router.get('/sendMsg', function(req, res){
  console.log('sendMsg');
  msgAlert.sendMsg("guest121019@gmail.com", "pnthoai165@gmail.com", function(res){
    console.log(res);
  });
});


// testing intermission page
router.get('/intermission', sessionChecker, function(req, res){
  res.render('../views/intermission', { tree: { name: 'test' } });
});


router.get(['/', '/home'], sessionChecker, function(req, res) {
  console.log('req from:' + req.url);
  db().collection('tree').find({
    user: req.signedCookies['secid'],
  }).toArray(function(err, treeLst){
    if(err) throw err;
    let trees = [], everyTreeWater="YES", lastWatering=new Date('01-01-2020');

    treeLst.forEach((tree) => {
      trees.push(tree.name);
      if(tree.water){
        Object.keys(tree.water).forEach((key)=>{
          if(new Date(key) < new Date()){
            everyTreeWater = "NO";
          }
          if(new Date(key + "T" + tree.water[key]) >= lastWatering){
            lastWatering = new Date(key + "T" + tree.water[key]);
          }
        });
      }
    });
    console.log(trees);

    res.render('../views/index', { data: trees, everyTreeWater: everyTreeWater, lastWatering: lastWatering });
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

  console.log(temperatureMinValue, temperatureMaxValue, moistureMinValue, moistureMaxValue, humidityMinValue, humidityMaxValue);

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
    console.log(trees);
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
    let data = {};
    tree.forEach((items, i)=>{
      let currentDay = new Date(new Date().toISOString().split("T")[0]);
      for(let i=0; i<7; i++){
        let yyyymmdd = currentDay.toISOString().split("T")[0].split('-');
        let day = yyyymmdd[2] + '/' + yyyymmdd[1] + '/' + yyyymmdd[0];
        let itemDay = yyyymmdd.join('-');

        data[day] = { water: [], sensorData: [], };
        data['schedule'] =  items.schedule;

        if(items.water.hasOwnProperty(itemDay)){
          data[day].water = items.water[itemDay];
        }

        items.data.forEach((item, i)=>{
          if(new Date(item.date.toISOString().split("T")[0]).getTime() == currentDay.getTime()){ // only ==, !=, ===, and !== require .getTime()
            data[day].sensorData.push({
              time: item.date.getUTCHours() + ':' + item.date.getUTCMinutes(),
              temperature: item.temperature,
              moisture: item.moisture,
              humidity: item.humidity,
            });
          }
        });

        if(data[day].water.length == 0){
          data[day].water.push('None');
        }

        if(data[day].sensorData.length == 0){
          data[day].sensorData.push({
            time: "NA",
            temperature: "NA",
            moisture: "NA",
            humidity: "NA",
          });
        }

        // console.log(currentDay);
        currentDay.setDate(currentDay.getDate() - 1);
        // console.log(data[day]);
      }
    });

    ejs.renderFile("./public/Report_Template.ejs", { tree: { name: req.body.tree.name, data: data, } }, (err, data) => {
      if (err) {
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
        pdf.create(data, options).toFile(__dirname + "/../public/" + "/Report_" + req.body.tree.name + ".pdf", function (err, resp) {
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

// render tree page
router.get('/tree/:treeName', sessionChecker, function(req, res) {
  let treeName = req.params.treeName;
  db().collection('tree').find({
    name: treeName,
    user: req.signedCookies['secid'],
  }).toArray(function(err, result){
    if(err) throw err;

    let temp=0, mois=0, humi=0, isWaterToday="NO", lastWater=new Date('01-01-2020'), sensors=[], isWatering=false;
    result.forEach((tree, i) => {
      temp = tree.currentData.temperature;
      mois = tree.currentData.moisture;
      humi = tree.currentData.humidity;
      sensors = tree.sensor;
      isWatering = tree.isWatering;
      if(tree.water && tree.water.length > 0){
        let length = Object.keys(tree.water).length - 1;
        if(Object.keys(tree.water)[length]){
          isWaterToday = (Object.keys(tree.water)[length] == new Date().toISOString().split("T")[0]) ? "YES" : "NO";
          lastWater =  tree.water[Object.keys(tree.water)[length]][0] + "T" + Object.keys(tree.water)[length].split("-")[2] + "-" + Object.keys(tree.water)[length].split("-")[1] + "-"  + Object.keys(tree.water)[length].split("-")[0];
        }
      }
    });
    // console.log(sensors);
    console.log(req.params.treeName, isWatering, lastWater);

    res.render('../views/tree', {
      tree: {
        name: treeName,
        temperature: temp, moisture: mois, humidity: humi,
        isWaterToday: isWaterToday, lastWater: lastWater,
        sensors: sensors,
        isWatering: isWatering,
      },
    });
  });
});

// get tree page submit
router.post('/tree/:treeName', sessionChecker, function(req, res) {
  console.log('post from tree:', req.url);
  let checkType=req.body.data.type;

  if(checkType.includes('schedule')){
    let today = new Date();
    // console.log(today.getFullYear(), '-', today.getMonth(), '-', today.getDate(), '-', req.body.data.hh, '-', req.body.data.mm, '-', 0);
    let treeName=req.params.treeName, freq=req.body.data.freq, waterLvl=req.body.data.waterLvl;
    let time = req.body.data.hh.padStart(2, "0") + ":" + req.body.data.mm.padStart(2, "0");
    // console.log(time);
    db().collection('tree').find({
      user: req.signedCookies['secid'],
      name: treeName,
    }).toArray((err, tree)=>{
      if(err) throw err;

      if(tree.length === 0){
        res.send({ success: false, msg: "no tree found!"});
      } else {
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

          res.send({ success: true, msg: "schedule" });
        });
      }
    });
    // res.send(req.body.data);
  } else if(checkType.includes('manual')) { // error may occur by schedule and manual
    let treeName=req.body.data.tree, flow=req.body.data.flow;

    if(checkType.includes('stop')){
      db().collection('tree').findOneAndUpdate({
        user: req.signedCookies['secid'], name: treeName,
      }, {
        $set: { isWatering: false, },
      }, { upsert: true, },
      function(err, result){
        if(err) throw err;
        res.clearCookie('waterTimeout');
      });
      res.send({ success: true });
    } else {
      db().collection('tree').find({
        user: req.signedCookies['secid'], name: treeName,
      }).toArray((err, trees)=>{
        if(err) throw err;

        if(trees.length === 0){
          res.send({ success: false, msg: "no tree found!"});
        } else {
          var today = "water." + new Date().toISOString().split('T')[0], time=new Date().getHours().toString().padStart(2, "0") + ":" + new Date().getMinutes().toString().padStart(2, "0");

          if(flow == ''){
            flow = 100;
          }

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
              db().collection('tree').findOneAndUpdate({
                user: req.signedCookies['secid'], name: treeName,
              }, {
                $set: { isWatering: false, },
              }, { upsert: true, },
              function(err, result){
                if(err) throw err;
              });
            }, 1000*flow);

            let options = {
              maxAge: 1000 * flow, // expire after 1 day
              httpOnly: true, // The cookie only accessible by the web server
              signed: true // Indicates cookie should be signed
            }
            res.cookie('waterTimeout', waterTimeout, options);
            res.send({ success: true, msg: "watering" });
          });
        }
      });
    }
    // res.send({ success: false, msg: "no tree found!"});
  } else {
    res.send('Incorrect Order!');
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
    let averageTemp=0, averageMois=0, averageHumi=0, cnt=0, current=new Date(result[0].data[0].date.toISOString().split('T')[0]);
    result[0].data.forEach((item, i) => {
      let itemDate = new Date(item.date.toISOString().split('T')[0]);
      if(itemDate < current){
        data.push({
          date: current,
          averageTemp: parseInt(averageTemp/cnt),
          averageMois: parseFloat(averageMois/cnt),
          averageHumi: parseInt(averageHumi/cnt),
        });
        current = itemDate;
        averageTemp = item.temperature;
        averageMois = item.moisture;
        averageHumi = item.humidity;
        cnt = 0;
      } else {
        averageTemp += item.temperature;
        averageMois += item.moisture;
        averageHumi += item.humidity;
      }
      cnt++;
    });
    data.push({
      date: current,
      averageTemp: parseInt(averageTemp/cnt),
      averageMois: parseFloat(averageMois/cnt),
      averageHumi: parseInt(averageHumi/cnt),
    });

    // console.log(data);
    res.render('../views/report', { tree: { name: req.params.treeName, data: data } });
  });
});

router.get('/addSensor', sessionChecker, function(req, res){
  db().collection('tree').find({
    user: req.signedCookies['secid'],
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

router.post('/addSensor', sessionChecker, function(req, res) {
  // console.log('post add sensor', req.url);
  // console.log(req.body.data);
  if(req.body.data.type.includes('update-tree')){
    let treeName=req.body.data.treeName, tempName=req.body.data.temperature, moisName=req.body.data.moisture, humiName=req.body.data.humidity, user=req.signedCookies['secid'];
    let sensor=[], today=new Date();

    db().collection('tree').find({
      user: req.signedCookies['secid'],
      name: treeName,
    }).toArray((err, trees)=>{
      if(err) throw err;

      if(tempName != ''){
        sensor.push({
          temperature: tempName,
          date: today,
        });
      }
      if(moisName != ''){
        sensor.push({
          moisture: moisName,
          date: today,
        });
      }
      if(humiName != ''){
        sensor.push({
          humidity: humiName,
          date: today,
        });
      }

      if(trees.length > 0){
        trees.forEach((tree, i) => {
          if(tempName == ''){
            tree.sensor.forEach((item, i) => {
              if(Object.keys(item).includes('temperature')){
                sensor.push(item);
              }
            });
          }
          if(moisName == ''){
            tree.sensor.forEach((item, i) => {
              if(Object.keys(item).includes('moisture')){
                sensor.push(item);
              }
            });
          }
          if(humiName == ''){
            tree.sensor.forEach((item, i) => {
              if(Object.keys(item).includes('humidity')){
                sensor.push(item);
              }
            });
          }
        });

        db().collection('tree').findOneAndUpdate({
          user: req.signedCookies['secid'],
          name: treeName,
        }, {
          $set: {
            sensor: sensor,
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
            user: [user],
            isWatering: false,
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
