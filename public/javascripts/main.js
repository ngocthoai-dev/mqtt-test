function panel_toggle(idx=0){
  let filterPanel = document.getElementsByClassName('filter-panel')[idx];
  if(filterPanel.style.display === 'none' || filterPanel.style.display === ''){
    filterPanel.style.cssText = 'display: flex !important';
  } else {
    filterPanel.style.cssText = 'display: none !important';
  }
}

function watering_toggle(){
  let filterPanel = document.getElementsByClassName('watering')[0];
  if(window.getComputedStyle(filterPanel).getPropertyValue('display') === 'none'){
    filterPanel.style.cssText = 'display: flex !important';
  } else {
    filterPanel.style.cssText = 'display: none !important';
  }
}

const getTreeFilter = ()=>
  axios.get('/operation/getFilterTrees')
    .then((res)=>res.data)
    .catch((err)=>{
      console.log(err);
  });;

const postTreeFilter = (data)=>
  axios.post('/operation/filterTreeList', {data})
  .then((resp)=>resp.data);;;

// index
function createTreeListElement(treeName){
  let liTag = document.createElement('li');
  liTag.className = 'list-group-item border-0 p-1';
  let aTag = document.createElement('a');
  aTag.href = '/tree/' + treeName;
  let buttonTag = document.createElement('button');
  buttonTag.className = 'btn btn-success tree-elems w-100';
  buttonTag.type = 'button';
  buttonTag.textContent = treeName;
  aTag.appendChild(buttonTag);
  liTag.appendChild(aTag);
  return liTag;
}

function filter_submit(evt){
	evt.preventDefault();
	postTreeFilter({
		TreeName: evt.target[1].value,
		TemperatureMinValue: evt.target[2].value,
		TemperatureMaxValue: evt.target[3].value,
		MoistureMinValue: evt.target[4].value,
		MoistureMaxValue: evt.target[5].value,
		HumidityMinValue: evt.target[6].value,
		HumidityMaxValue: evt.target[7].value,
	}).then(res=>{
    console.log(res);
    let ulTree = document.getElementsByClassName('list-tree')[0];
    while(ulTree.firstChild){
      ulTree.removeChild(ulTree.firstChild);
    }
    res.forEach((item, i) => {
      ulTree.appendChild(createTreeListElement(item));
    });
  });
  panel_toggle();
}

// tree
const postTreeWater = (data, treeName)=>
  axios.post("/tree/" + treeName, {data: data})
  .then((resp)=>resp.data);

function tree_schedule_water(evt, treeName){
	evt.preventDefault();
  // console.log(evt.target[0].value, "-", evt.target[1].value, "-", evt.target[2].value, "-", evt.target[3].value);
	postTreeWater({
    freq: evt.target[0].value,
		hh: evt.target[1].value,
		mm: evt.target[2].value,
		waterLvl: evt.target[3].value,
    type: 'schedule',
	}, treeName).then(res=>{
    console.log(res);
  }).catch(error => {
    console.log(error.response);
  });
}

let wateringTimeoutIntermission;
function tree_manual_water(evt, treeName){
  // console.log(evt.target);
	evt.preventDefault();
	postTreeWater({
		flow: evt.target[1].value,
		tree: treeName,
    type: 'manual',
	}, treeName).then(res=>{
    if(res.data.success) {
      watering_toggle();
      wateringTimeoutIntermission = setTimeout(function(){
        watering_toggle();
      }, evt.target[1].value*1000);
    } else {
      console.log(res.data.success);
    }
  });
}
function stop_manual_water(evt, treeName){
  evt.preventDefault();
  postTreeWater({
    type: 'manual-stop',
    tree: treeName,
  }, treeName).then(res=>{
    console.log(res);
    if(res.data.success){
      clearTimeout(wateringTimeoutIntermission);
      watering_toggle();
    }
  });
}

// report/tree
function getFullyReport(evt, treeName){
  evt.preventDefault();
  axios.post('/generate-report', { tree: { name: treeName } }).then((res)=>{
    // console.log(res);
    axios.get('/fetch-report/' + treeName, { responseType: 'blob' }).then((res)=>{
      // console.log(res);
      const pdfBlob = new Blob([res.data], { type: 'application/pdf' });
      // console.log(pdfBlob);
      saveAs(pdfBlob, 'Report_' + treeName + '.pdf');
    }).catch(error=>{
      console.log(error.response);
    });
  });
}


function givePermission(evt, treeName){
  evt.preventDefault();
  let user = document.getElementsByClassName('add-user')[0].firstElementChild.value;
  axios.post('/givePermission', {
    treeName: treeName,
    user: user,
  }).then((res)=>{
    console.log(res.data.success);
    if(res.data.success){
			swal({
				title: "Updated!",
				text: "You give permission of this tree to " + user,
				icon: "success",
				button: "Done!",
			});
    } else {
			swal({
				title: "Wrong user!",
				text: res.msg,
				icon: "warning",
				button: "Retry!",
			});
    }
  });
}


function addEmail(evt){
  evt.preventDefault();
  let email = document.getElementsByClassName('add-email')[0].firstElementChild.value;
  axios.post('/addEmail', {
    email: email,
  }).then((res)=>{
    if(res.data.success){
			swal({
				title: "Updated!",
				text: "You add your email: " + email,
				icon: "success",
				button: "Done!",
			});
    } else {
			swal({
				title: "Wrong email!",
				text: res.msg,
				icon: "warning",
				button: "Retry!",
			});
    }
  });
}
