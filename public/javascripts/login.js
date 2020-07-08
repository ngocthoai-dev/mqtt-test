function login(evt){
	evt.preventDefault();
	let data = {
		username: evt.target.username.value,
		password: evt.target.password.value,
		type: 'login',
	};
	axios.post('/users/', { data: data }).then((res)=>{
		// console.log(res);

		let newNode = document.createElement('span');
		newNode.classList.add("span-msg");
		let parentTag = evt.target;
		// console.log(evt.target);
		parentTag.querySelector('span.span-msg') ? parentTag.removeChild(parentTag.querySelector('span.span-msg')) : console.log('');

		if(res.data.success == false){
			if(res.data.tagMsg.includes('username')){
			  newNode.appendChild(document.createTextNode(res.data.msg));
				parentTag.insertBefore(newNode, parentTag.querySelector('.one').nextSibling);
			} else if(res.data.tagMsg.includes('password')){
			  newNode.appendChild(document.createTextNode(res.data.msg));
				parentTag.insertBefore(newNode, parentTag.querySelector('.two').nextSibling);
			}
		} else {
			console.log('login');
			window.location.href = "/";
		}
	});
}

function register(evt){
	evt.preventDefault();
	let data = {
		username: evt.target.username.value,
		password: evt.target.password.value,
		repassword: evt.target.repassword.value,
		type: 'register',
	};
	axios.post('/users/', { data: data }).then((res)=>{
		// console.log(res);

		let newNode = document.createElement('span');
		newNode.classList.add("span-msg");
		let parentTag = evt.target;
		// console.log(evt.target);
		parentTag.querySelector('span.span-msg') ? parentTag.removeChild(parentTag.querySelector('span.span-msg')) : console.log('');

		if(res.data.success == false){
			if(res.data.tagMsg.includes('username')){
			  newNode.appendChild(document.createTextNode(res.data.msg));
				parentTag.insertBefore(newNode, parentTag.querySelector('.one').nextSibling);
			} else if(res.data.tagMsg.includes('repassword')){
			  newNode.appendChild(document.createTextNode(res.data.msg));
				parentTag.insertBefore(newNode, parentTag.querySelector('.three').nextSibling);
			} else if(res.data.tagMsg.includes('password')){
			  newNode.appendChild(document.createTextNode(res.data.msg));
				parentTag.insertBefore(newNode, parentTag.querySelector('.two').nextSibling);
			}
		} else {
			console.log('register');
			window.location.href = "/";
		}
	});
}