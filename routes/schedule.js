const db = require('../routes/dbConnection').db;

let schedule_water_list={}, treeInWater={};
// {
//   treeName: {
//     user: [],
//     isWatering: false,
//     time: '',
//   },
// }

const publish_motor = require('../routes/mqtt_connection').publish_motor;
function wateringSchedule(schedule, treeName, users, level) {
  console.log("watering on:", treeName, "of", users);
  let today = "water." + new Date().toISOString().split('T')[0], time=new Date().getHours().toString().padStart(2, "0") + ":" + new Date().getMinutes().toString().padStart(2, "0");
  // set schedule watering
  db().collection('tree').findOneAndUpdate({
    name: treeName,
    user: users,
  }, {
    $push: {
      [today]: { $each: [time], $position: 0, }
    },
    $set: { isWatering: true, },
  }, { upsert: true, },
  function(err, res){
    if(err) throw err;
    // console.log(res);
    let data = [], value="0", flow=res.value.schedule.level;
    var motor=res.value.motor.name;
    if(flow > 60*10){
      value = "255";
    } else if(flow > 60*5){
      value = "180";
    } else {
      value = "100";
    }
    data.push({
      "device_id": "LightD",
      "values": ["1", value],
    });
    // console.log(data);
    publish_motor(motor, JSON.stringify(data));

    // set stop watering
    schedule['timeout'] = setTimeout(()=>{
      console.log("stop watering on:", treeName, "of", users);
      db().collection('tree').find({
        name: treeName,
      }).toArray((err, trees)=>{
        if(err) throw err;

        trees.forEach((tree, i) => {
          if(tree.isWatering == true){
            db().collection('tree').updateOne({
              name: treeName,
              user: users,
            }, {
              $set: { isWatering: false, },
            }, function(err, res){
              if(err) throw err;
              // console.log(res);

              let data = [];
              data.push({
                "device_id": "LightD",
                "values": ["0", "0"],
              });

              publish_motor(motor, JSON.stringify(data));
            });
          }
        });
      });
    }, 1000*level);
  });
}

const deleteScheduleList = (treeName)=>{
  clearInterval(schedule_water_list[treeName].interval);
  clearTimeout(schedule_water_list[treeName].timeout);
}

let fetch_schedule_water = ()=>{
  // make schedule routine
  let scheduleFunc = ()=>{
    console.log('auto');

    db().collection('tree').find({
    }).toArray((err, trees)=>{
      if(err) throw err;

      trees.forEach((tree, i) => {
        if(Object.keys(tree.schedule).length < 3)
          return;
        if(tree.schedule && tree.schedule.frequency != 0){
          if((treeInWater[tree.name] != undefined && treeInWater[tree.name].time.localeCompare(tree.schedule.time)) || treeInWater[tree.name] == undefined){
            if(schedule_water_list[tree.name]){
              deleteScheduleList(tree.name);
            }
            let scheduleTime = new Date();
            scheduleTime.setHours(tree.schedule.time.toString().split(':')[0], tree.schedule.time.toString().split(':')[1], 0);
            if(scheduleTime <= new Date()){
              scheduleTime.setDate(scheduleTime.getDate()+1);
            }
            let today = new Date();
            today.setSeconds(scheduleTime.getSeconds());
            let timeToSchedule = Math.abs(today - scheduleTime);
            treeInWater[tree.name] = {
              user: tree.user,
              isWatering: tree.isWatering,
              time: tree.schedule.time,
            }
            console.log(timeToSchedule);

            setTimeout(()=>{
              var schedule={}, treeName=tree.name, users=tree.user;
              wateringSchedule(schedule, treeName, users, tree.schedule.level);
              schedule['interval'] = setInterval(wateringSchedule, 1000*60*60*24*tree.schedule.frequency);

              schedule_water_list[tree.name] = schedule;
            }, timeToSchedule);
          }
        }
      });
    });
  }

  scheduleFunc();
  // check update every minute
  setInterval(scheduleFunc, 1000*60);
}

module.exports = {
  fetch_schedule_water,
  scheduleList: {
    getScheduleList: ()=>schedule_water_list,
    deleteScheduleList: deleteScheduleList,
  },
};
