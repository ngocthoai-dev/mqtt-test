const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require("cookie-parser");
const session = require("express-session");
const moment = require('moment');
const pdf = require('html-pdf');
const ejs = require('ejs');
const path = require('path');

// secured id
const secid = require('../routes/custom_hashing').getSecId();

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


// mqtt connect
const mqtt = require('mqtt');
let mqttClient = mqtt.connect('mqtt:52.163.220.103:1883');
mqttClient.on('connect', function() {
  mqttClient.subscribe('water', function(err, granted) {
    console.log('connected');
    if (!err) {
      console.log(granted);
    }
  });
});

mqttClient.on('message', function(topic, message) {
  // message is Buffer
  console.log(topic);
  console.log(message.toString());
});

// routing section
let router = express.Router();


// testing intermission page
router.get('/intermission', function(req, res){
  res.render('../views/intermission', { tree: { name: 'test' } });
});


router.get(['/', '/home'], sessionChecker, function(req, res) {
  console.log('req from:' + req.url);
  db().collection('tree').find({}).toArray(function(err, treeLst){
    if(err) throw err;
    let trees = [];
    treeLst.forEach((tree) => {
      trees.push(tree.name);
    });
    console.log(trees);
    res.render('../views/index', { data: trees });
  });
});

// filtering operation
router.post('/operation/filterTreeList', function(req, res, next) {
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

  db().collection('tree').find({
    name: { "$regex": req.body.data.TreeName, "$options": "i" },
    data: { $elemMatch : {
      temperature: { "$gte": parseInt(temperatureMinValue), "$lte": parseInt(temperatureMaxValue) },
      moisture: { "$gte": parseInt(moistureMinValue), "$lte": parseInt(moistureMaxValue) },
      humidity: { "$gte": parseInt(humidityMinValue), "$lte": parseInt(humidityMaxValue) } } },
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
router.post('/generate-report', function(req, res){
  console.log('report gen from req:', req.url);
  let test;
  db().collection('tree').find({
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
    // };
    let data = {};
    tree.forEach((items, i)=>{
      let currentDay = new Date(new Date().toISOString().split("T")[0]);
      for(let i=0; i<7; i++){
        let yyyymmdd = currentDay.toISOString().split("T")[0].split('-');
        let day = yyyymmdd[2] + '/' + yyyymmdd[1] + '/' + yyyymmdd[0];
        let itemDay = yyyymmdd.join('-');

        data[day] = { water: [], sensorData: [] };

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

    ejs.renderFile("./public/Report_Template.ejs", { tree: { name: req.body.tree.name, data: data } }, (err, data) => {
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
router.get('/fetch-report/:treeName', function(req, res){
  console.log("fetch report:", req.url);
  // resolve for avoid malicious error
  res.sendFile(path.resolve(__dirname + "/../public/Report_" + req.params.treeName + ".pdf"));
});

// render tree page
router.get('/tree/:treeName', sessionChecker, function(req, res) {
  console.log(req.params.treeName);
  db().collection('tree').find({
    name: req.params.treeName,
  }).toArray(function(err, result){
    if(err) throw err;

    let temp=0, mois=0, humi=0, isWaterToday="NO", lastWater=new Date('01-01-2020');
    result.forEach((item, i) => {
      temp = item.data[0].temperature;
      mois = item.data[0].moisture;
      humi = item.data[0].humidity;
      if(Object.keys(item.water)[0]){
        isWaterToday = (Object.keys(item.water)[0] == new Date().toISOString().split("T")[0]) ? "YES" : "NO";
        lastWater =  item.water[Object.keys(item.water)[0]] + "T" + Object.keys(item.water)[0].split("-")[2] + "-" + Object.keys(item.water)[0].split("-")[1] + "-"  + Object.keys(item.water)[0].split("-")[0];
      }
    });

    res.render('../views/tree', { tree: { name: req.params.treeName, temperature: temp, moisture: mois, humidity: humi, isWaterToday: isWaterToday, lastWater: lastWater } });
  });
});

// get tree page submit
router.post('/tree/:treeName', function(req, res) {
  console.log(req.url);
  let checkType = req.body.data.type;
  if(checkType.includes('schedule')){
    res.send(req.body.data);
  } else if(checkType.includes('manual')) {
    res.send(req.body);
  } else if(checkType.includes('report')){
    res.send(req.body);
  } else {
    res.send('Incorrect Order!');
  }
});

// report to tree name
router.get('/report/:treeName', sessionChecker, function(req, res){
  console.log('get report:' + req.url);
  let now = new Date();
  db().collection('tree').find({
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
  db().collection('tree').find({}).toArray(function(err, treeLst){

    if(err) throw err;
    console.log('req add sensor:', req.url);
    let trees = [];
    treeLst.forEach((tree) => {
      trees.push(tree.name);
    });
    console.log(trees);
    res.render('../views/addSensor', { data: trees });
  });
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
