z.depends = {
	initialize_visibility : function(scope) {
		var dep_elements = dojo.query(".depends",scope);
		//console.log('initialize_visibility cnt='+dep_elements.length)		
		for (var i=0,len=dep_elements.length; i<len; i++){
			statement = z.depends.get_statement(dep_elements[i]);
			if (statement) {
				//console.log('initialize_visibility ',statement)
				z.depends.initialize_element(statement, dep_elements[i]);
				z.depends.evaluate_visibility(statement, dep_elements[i]);
			}
		}
	},
	remove_visibility : function(scope){ //todo: this function was not tested
		var dep_elements = dojo.query(".depends",scope);
		for (var i=0,len=dep_elements.length; i<len; i++){
			if (dep_elements[i]._masters){
				for (master in dep_elements[i]._masters) {
					if (master._dependents){
						for (var j=0,l=master._dependents.length; i<l; i++){
							if (master._dependents[j] == dep_elements[i]) {
								master._dependents.splice(j,1);
							}
						}
					}
				}
			}
		}
		dojo.query("[_connect]",scope).forEach(function(item){ item.removeAttribute("_connect") });
		dojo.query("[_dependents]",scope).forEach(function(item){ item.removeAttribute("_dependents") });
	},
	initialize_element : function(statement,dep_element){
		//var identifiers=statement.match(/[\.#@][\w\[\]~-]+/g);  
		var identifiers = z.depends.get_identifiers(statement);  
		if (identifiers) {
			identifiers=identifiers.sort();		
			var previousIdentifier="";
			for (var k=0,len=identifiers.length;k < len;k++){
				if (identifiers[k] != previousIdentifier) {
					previousIdentifier = identifiers[k];
					z.depends.process_identifier(identifiers[k],dep_element);
				}
			}
		}
	},
	get_statement : function(element){
		var classes=element.className.split(" ");
		for (var j=0,len=classes.length; j<len; j++) {
			if( classes[j] === "depends" && classes[j+1] ){
				return classes[j+1];
			}
		}
		//for (var j=0,len=classes.length; j<len; j++) {
		//	if (classes[j].search(/[=<>\[\];]+/)>0) {// checks if there are operators
		//		return classes[j];
		//	}
		//}
	},
	get_identifiers : function(statement){
		return statement.match(/[\.#@][\w\[\]~-]+/g);
	},
	process_identifier : function(identifier,dep_element){
		var master = z.depends.find_master(identifier,dep_element);
		if (master){
			if (master.length != null && master.nodeName !== 'SELECT'){
				for (var i=0,len=master.length; i<len; i++){
					z.depends.init_master(master[i],dep_element);
				}
			} else {
				z.depends.init_master(master,dep_element);
			}
		} else {
			console.error("Dependences init: " + identifier + " was not initialized.");
		}
	},
	
	init_master : function(master,dep_element){
		if (!(master._dependents instanceof Array))	master._dependents = [];
		master._dependents.push(dep_element);
		if((master.type === "checkbox" || master.type === "radio")&&(!master._connect)){
			master._connect = z.addListener(master, "click", on_master_change);
		} else if (!master._connect) {
			master._connect = z.addListener(master, "change", on_master_change);
		}
		if (!(dep_element._masters instanceof Array)) dep_element._masters = new Array;
		dep_element._masters.push(master);
	},
	
	find_master : function(identifier,dep_element){
		var master;
		var selector = identifier.charAt(0);
		var i = identifier.indexOf("[");
		if (i == -1) i = identifier.indexOf("]");
		if (i === -1) { // no [ or ]
			if (selector === "@"){
				master = document.getElementsByName(identifier.slice(1));
			} else if (selector === "."){
				var container = dep_element;
				while (!(master||container.nodeName==='FORM')) {
					container = container.parentNode;
					master = dojo.query(identifier,container)[0];
					if (master) {
						if (!((master.nodeName === "INPUT")||(master.nodeName === "TEXTAREA"))){
							if (master.getElementsByTagName("input")[0]) master = master.getElementsByTagName("input")[0];  
							if (master.getElementsByTagName("textarea")[0]) master = master.getElementsByTagName("textarea")[0];  
						}
					}
				}
			} else if (selector === "#"){
				master = document.getElementById(identifier.slice(1));
			}
		} else { //contains [ or ]
			var name = identifier.slice(1,i);
			var value = identifier.slice(i+1);

			if (selector === "@"){
				var masters = document.getElementsByName(name);
				for (var j=0,len=masters.length; j<len; j++){
					
					if ( masters[j].type === "checkbox" && masters[j].value === value ){
						master = masters[j];
					} else if( masters[j].type === "radio" ){
						if( !master || !master.length ) master = [];
						master.push(masters[j]);
					}
	
				}
			} else if (selector === "."){
				var container = dep_element;
				while (!(master||container.nodeName==='FORM')) {
					container = container.parentNode;
					var masters = dojo.query("."+name+" input",container);
					for (var j=0,len=masters.length; j<len; j++){
						if ((masters[j].type === "checkbox" || masters[j].type === "radio")&&(masters[j].value === value))	master = masters[j];
					}
				}
			} else if (selector === "#"){
				master = document.getElementById(name);
			}
		}
		return master;
	},
	
	on_master_change : function(){
		var start = new Date();
		for (var i=0,len=this._dependents.length; i<len; i++){
			statement = z.depends.get_statement(this._dependents[i]);
			if (statement) {
				z.depends.evaluate_visibility(statement,this._dependents[i]);
			}
		}
		var elapsed = (new Date()) - start;
		//console.info(this.id+" : "+elapsed+" ms\n\n");
	},
	evaluate_visibility : function(statement, element) {
		var orig = statement;
		statement = statement.replace(/\={1}/g, "===");
		statement=statement.replace(/!\==={1}/g, "!==");
		statement=statement.replace(/AND/g, "&&");
		statement=statement.replace(/;GT;/g, ">");
		statement=statement.replace(/;LT;/g, "<");
		statement=statement.replace(/\|{1}/g, "||");		
		statement=statement.replace(/OR/g, "||");		
		statement=statement.replace(/{/g, "'");
		statement=statement.replace(/}/g, "'");
		var identifiers = z.depends.get_identifiers(statement);
		if (identifiers instanceof Array){
			statement = z.depends.replaceIdentifiers(statement,element,identifiers);
		}
		var visible=true;
		try {
			visible = eval(statement);
		} catch(e) {
			console.error("Dependences: " + element.className +' => '+statement);
			visible = true;
		}			
		if (visible) {
			showElement(element);
		} else {
			hideElement(element);
		}
		if( dojo.hasClass(element, "debug") ){
			console.info(orig + ' => ' + statement); // +" ==> "+visible+" titles:"+titles.length+"\n");
		}
	},
	showElement : function(element) {
		element.style.display = "";
	},
	hideElement : function(element) {
		element.style.display = "none";
	},

	replaceIdentifiers : function(statement,element,identifiers){
		identifiers = identifiers.sort();
		var identifier = "";
		for(var k=0, len=identifiers.length; k<len; k++) {
			if (identifiers[k] !== identifier) {
				identifier = identifiers[k];
				master = z.depends.find_master(identifier,element);
				if (master){
					var value = z.depends.get_input_value(master);
				}else{
					console.error("Dependences: No "+identifier+" value!");
					var value = null;
				}
				if (identifier.indexOf('[') != -1) {
					identifier = identifier.replace(/\[/g,"\\[");
				} else  if (identifier.indexOf(']') != -1) {
					identifier = identifier.replace(/\]/g,"\\]");
					value = ! value;
				}

				var re = new RegExp(identifier,"g");
				if (typeof value === "string"){
					if (((+value) != value)||(value == '')){
						value = "'"+value+"'";
					}
				}
				statement = statement.replace(re,value);
			}
		}
		return statement;
	},
	get_input_value : function(master){
		var value;
		if (master.nodeName === "SELECT") {
			value = master.value;
		} else if (master.length != null){
			value = "";
			for (var i=0,len=master.length; i<len; i++){
				if (master[i].checked) value = value+","+master[i].value;
			}
		}
		else if (master.type === "checkbox"||master.type === "radio") value = master.checked;
		else if (dojo.hasClass(master,"x_combo_hidden")) value = master.value;
		else if (master.nodeName === "INPUT") value = master.value;
		else if (master.nodeName === "TEXTAREA") value = master.value;
		return value;
	}
}
