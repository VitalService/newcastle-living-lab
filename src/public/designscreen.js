var project = { id: 'project', name: 'Project', creator: 'unknown', type: 'Project', createdate: 'ddmmyyyy', lastdate: 'ddmmyyyy', screenheight: 1080, screenwidth: 1920, layers: [], presentevents: [], starteventviews: [], groups: [] };
var fullscreen = false;
var openedproject = false; //used to control tree node unpacking
var projectopened = false; //whether project opened or new
var nodelist = [];  // list of {parentid:id,nodeid:nid,nodestate:state}
var selectedObjlist = [];
var listcounter = 0;
var showall = false;
var sw, sh;
var USEIO = true;
var socket;
var serverurl = [window.location.protocol, '//', window.location.hostname, ':', window.location.port].join('').replace(/:$/, '');
var txscale = 1.0;
var last_saved_project_hash = null;
var saving_project = false;
var showLeftCol = true;



function showLoading(text) {
	$("[data-modal='loading'] [data-ui='content']").text(text);
	activateModal('loading');
}

function activateModal(ref) {
	$("input.toggle-check").prop('checked', false).removeAttr('checked');
	if (ref && ref.length) {
		$("input#toggle_" + ref).prop('checked', 'checked');
	}
}


function makeCurvedArrow() {
	if (layer != null) {
		var obj = addobj('CurvedArrow');
		var state = obj.getAttr('state');
		state.name = uniqueNameonLayer(obj);
		obj.name(state.name);
		//console.log(obj);
		obj.setAttr('state', state);
		addTreeNode(layer.id(), obj.id(), state);
	}
	else {
		alert('no layer is defined');
	}

}



function updateprojState(prop) {
	/**
	* Updates the state attribute of the project
	*/
	var propkey = Object.keys(prop)[0];
	var propval = prop[propkey];
	//console.log(propkey,propval);
	project[propkey] = propval;
	if (propkey == 'name') {
		treecontainer.jstree(true).rename_node(selectednode, propval);
	}
	if (propkey == 'screenwidth' || propkey == 'screenheight') {
		//adjust active screen area and txscale
		stageDims();
		//project.screenwidthstage.setAttr('state',stagestate);
	}


}

function updateprojPropDisp() {
	/**
	*Updates the displayed properties of the project
	*/
	var state = project;

	//make table to display
	$("#proptable").empty();
	for (var key in state) {
		if (key != 'layers' && key != 'actions' && key != 'library' && key != 'id' && key != 'presentevents' && key != 'starteventviews' && key != "groups") {
			var propval = state[key];
			if (key == 'type' || key == 'createdate' || key == 'lastdate') {
				$("#proptable").append('<tr><td class="tablekey">' + key + '</td><td class="tableval" style="text-align:left">' + propval + '</td></tr>');

			} else {

				if (isNaN(propval) || propval === '') {
					$("#proptable").append('<tr><td class="tablekey">' + key + '</td><td class="tableval"><input id="prop' + key + '" type="text" style="text-align:left" size="10" onchange="updateprojState({' + key + ':this.value})"></td></tr>');
				}
				else {
					$("#proptable").append('<tr><td class="tablekey">' + key + '</td><td class="tableval"><input id="prop' + key + '" type="text" style="text-align:right" size="10" onchange="updateprojState({' + key + ':checkInput(this.value)})"></td></tr>');
				}

				var el = document.getElementById("prop" + key);

				if (isNaN(propval) || propval === '' || propval === null) {
					$("#prop" + key).val(propval);
				} else {
					var num = parseFloat(propval);
					if ((num % 1) == 0.0) {
						$("#prop" + key).val(propval.toFixed(0));
					} else {
						$("#prop" + key).val(propval.toFixed(2));
					}
				}
			}
		}
	}
}

function updateObjStateandTree(prop) {
	/**
	* Updates the state attribute and the tree node of the active object
	* This calls the updateGroupState or updateState functions in llcore.js depending on the type
	*/
	if (selectedObjlist.length > 1) {
		for (var obji = 0; obji < selectedObjlist.length; obji++) {
			var obj = selectedObjlist[obji];
			var state = obj.getAttr('state');
			if (state.type == 'Group') {
				updateGroupState(obj, prop);
			}
			else {
				updateState(obj, prop);
			}
		}
		activeobject = obj;
	}
	else if (activeobject != null) {
		var state = activeobject.getAttr('state');
		if (state.type == 'Group') {
			updateGroupState(activeobject, prop);
		}
		else {
			updateState(activeobject, prop);
		}
		var propkey = Object.keys(prop)[0];
		var propval = prop[propkey];
		//console.log(propkey,propval);
		//update tree if there
		if (treecontainer && propkey == 'name') {
			treecontainer.jstree(true).rename_node(selectednode, propval);
		}

	}
}

function libuse() {
	/**
	* Adds the selected library object on the libpane to the active layer and creates a treenode for it
	*/
	if (layer != null) {
		if (activelibobj != null) {
			var dw = $('#designspace').width();
			var dh = $('#designspace').height();
			var statestr = JSON.stringify(activelibobj.getAttr('state'));
			var state = JSON.parse(statestr);
			state.x = state.x + Math.floor(dw / 2);
			state.y = state.y + Math.floor(dh / 2);
			//console.log(state);
			if (state.type == 'Group') {
				var obj = newgroupobj(true, false, state);
				state.name = uniqueNameonLayer(obj);
				state.id = UniqueId();  //replace id if used from library else objects will have same ids
				obj.setAttr('state', state);
				layer.add(obj);
			}
			else {
				var obj = newobj(true, state);
				state.name = uniqueNameonLayer(obj);
				state.id = UniqueId();
				obj.setAttr('state', state);
				layer.add(obj);
			}
			obj.id(state.id);//replace id if used from library else objects will have same ids
			layer.draw();
			//console.log(obj.id());
			addTreeNode(layer.id(), obj.id(), state);
		}
	}
	else {
		alert('no layer is defined');
	}

}

function delObject() {
	/**
	* Deletes the selected object and removes it from the layer and tree
	*/
	if (activeobject != null) {
		var ans = confirm('Are you sure you want to delete this object?');
		if (ans == true) {
			//delete actions associated with object
			var actions = getNodeActions(activeobject);
			actlayer = layer.getAttr('actionlayer');
			for (var iact = 0; iact < actions.length; iact++) {
				actions[iact].destroy();
			}
			actlayer.draw();

			delobj();

			treecontainer.jstree(true).delete_node(selectednode);

		}
	}
}

function createObject() {
	var objtype = $('#objecttypeselect').val();
	//console.log(objdefaults);
	if (usedefaults == true && objdefaults[objtype] != null) {
		var objstate = JSON.parse(objdefaults[objtype]);
		objstate.id = 'none';
		objstate.name = 'none';
		//console.log(objstate);
		var obj = newobj(true, objstate);
		layer.add(obj);
		if (objSelector != null) {
			objSelector.deleteOldSelector();
			objSelector.drawSelector(obj);
		}
		activeobject = obj;
		updatePropDisp();
	}
	else {
		var obj = addobj(objtype);
		var objstate = obj.getAttr('state');
	}
	objstate.name = uniqueNameonLayer(obj);
	obj.name(objstate.name);
	obj.setAttr('state', objstate);
	layer.draw();

	addTreeNode(layer.id(), obj.id(), objstate);
}

function copyObject() {
	/**
	* Copies the selected object and adds it to the layer and tree with a unique name
	* Also assigns the selector object to the new copy
	*/
	if (activeobject != null) {
		var statestr = JSON.stringify(activeobject.getAttr('state'));
		var state = JSON.parse(statestr);
		state.name = 'none';
		state.id = 'none';
		state.x = state.x + 100;
		state.y = state.y + 100;
		//console.log(activeobject,state);
		if (state.type == 'Group') {
			var obj = newgroupobj(true, false, state);
		}
		else {
			var obj = newobj(true, state);
		}
		var objstate = obj.getAttr('state');
		objstate.name = uniqueNameonLayer(obj);
		obj.name(objstate.name);
		obj.setAttr('state', objstate);
		layer.add(obj);
		layer.draw();
		objSelector.deleteOldSelector();
		activeobject = obj;
		updatePropDisp();
		objSelector.drawSelector(obj);

		addTreeNode(layer.id(), obj.id(), objstate);
	}
}


function groupObjects() {
	/**
	* Groups all the objects added to the tempgroup into a new group object on the layer
	* removes the individual objects from tree before they are grouped
	* and creates a new group node for the group object in the tree
	*/
	for (var i = 0; i < tempgroup.length; i++) {
		var obj = tempgroup[i];
		//console.log(obj.id());
		treecontainer.jstree('delete_node', obj.id());
	}
	var grobj = groupobjects();
	var state = grobj.getAttr('state');
	state.name = uniqueNameonLayer(grobj);
	grobj.name(state.name);
	grobj.setAttr('state', state);
	addTreeNode(layer.id(), grobj.id(), state);
	ctrlkey = true;
	togMultiselect();
}

function ungroupObjects() {
	/**
	* Ungroups a group object into individual objects on the layer
	* Removes the group treenode and creates new tree nodes for the individual objects from the former group
	*/
	//delete actions associated with object
	var actions = getNodeActions(activeobject);
	actlayer = layer.getAttr('actionlayer');
	for (var iact = 0; iact < actions.length; iact++) {
		actions[iact].destroy();
	}
	actlayer.draw();

	var children = ungroupobjects();
	//console.log(children);
	if (children != null) {
		//remove active object from tree
		treecontainer.jstree(true).delete_node(selectednode);
		//add children to the tree
		for (var i = 0; i < children.length; i++) {
			var obj = children[i];
			//console.log(obj);
			var state = obj.getAttr('state');
			state.name = uniqueNameonLayer(obj);
			obj.name(state.name);
			obj.setAttr('state', state);
			//console.log(obj.id(),state.id);
			addTreeNode(layer.id(), obj.id(), state);
		}

	}
}

function filterlib() {
	/**
	* Displays the library objects found in the library database according to a filter term
	*/
	var filterstr = document.getElementById('filtername').value;
	clearObjects();
	loadObjects(filterstr);

}

function resetlib() {
	/**
	* Displays all the objects in the library database
	*/
	clearObjects();
	loadObjects('all');
}


function moveNode(node, newparentid, oldparentid, newposition, oldposition) {
	/**
	* Moves an object up or down in its z-index when the treenode of the object is moved in the tree
	*/
	var nodetype = node.type;
	switch (nodetype) {

		case 'Layer':
			layer.setZIndex(newposition);
			break;

		default:
			var newparent = treecontainer.jstree(true).get_node(newparentid);
			var oldparent = treecontainer.jstree(true).get_node(oldparentid);
			var oldlayer = stage.find('#' + oldparentid)[0];
			layer = stage.find('#' + newparentid)[0];

			obj = oldlayer.find('#' + node.id)[0];
			if (obj == null) {
				activeobject = null;
			}
			else {
				if (oldparentid == newparentid) {  //move within layer
					obj.setZIndex(newposition);
				}
				else {
					var actions = getNodeActions(obj);
					actlayer = layer.getAttr('actionlayer');
					for (var iact = 0; iact < actions.length; iact++) {
						actions[iact].moveTo(actlayer);
					}
					obj.moveTo(layer);
					obj.moveToTop();
					obj.setZIndex(newposition);
					treecontainer.jstree('select_node', newparentid);
				}
			}

			break;

	}

}

function selectObject(source) {
	/**
	* Manages the selection of the various node types of graphic objects such as stages, layers and shapes
	* Also determines whether the source of the selection is from the layer, tree or during grouping to manage events in the correct order
	*/
	var obj = null;
	switch (source) {
		case 'jstree':
			var id = selectednode.id;
			//console.log(selectednode.id);
			var nodetype = selectednode.type;

			switch (nodetype) {
				case 'Project':
					disableDesignButtons();
					clearActiveObject();
					clearTempGroup();
					updateprojPropDisp();
					break;

				case 'Layer':
					disableDesignButtons();
					clearActiveObject();
					clearTempGroup();
					if (stage != null) {
						stage.clear();
						layer = stage.find('#' + id)[0];
						if (layer != null) {
							activeobject = layer;
							actlayer = layer.getAttr('actionlayer');
							updatePropDisp();
							layer.draw();
							actstage.clear();
							actlayer.draw();
							$(document).trigger('object_selected', {
								'source': 'jstree',
								'type': 'layer',
								'layer': layer,
							});
						}
					}
					break;

				default:
					//search for objects across all layers
					selectedObjlist.length = 0;
					for (var nodei = 0; nodei < selbotnodes.length; nodei++) {
						var oid = selbotnodes[nodei];
						var lcount = 0;
						var projlayers = stage.getLayers().toArray();
						var lr = projlayers[0];
						obj = null;
						while (obj == null && lcount < projlayers.length) {
							obj = projlayers[lcount].find('#' + oid)[0];
							lcount = lcount + 1;
						}

						if (obj != null) {
							selectedObjlist.push(obj);
						}
					}
					//console.log(selectedObjlist);
					if (selectedObjlist.length > 0) {
						obj = selectedObjlist[0];
					}
					else {
						obj = null;
					}

					//console.log(obj);
					if (obj == null) {
						activeobject = null;
					}
					else if (selectedObjlist.length > 1) {  //multiple nodes selected
						updateMultiplePropDisp();
					}
					else {  // single selected object
						activeobject = obj;
						var oldlayer = layer;
						layer = activeobject.getLayer();
						if (layer != oldlayer) {
							stage.clear();
							layer.draw();
						}
						actlayer = layer.getAttr('actionlayer');
						updatePropDisp();
						actstage.clear();
						actlayer.draw();

						if (objSelector == null) {
							objSelector = new objectSelector();
						}
						objSelector.drawSelector(obj);
						enableDesignButtons();
						$('#actiontypeselect').empty();
						$('#actiontypeselect').append(makeActionTypeOptions(activeobject));
						//remember last actiontype
						var opts = $('#actiontypeselect option');
						var values = $.map(opts, function (opt) {
							return ($(opt).val());
						});
						//console.log(values);
						if ($.inArray(activeactiontype, values) != -1) {
							$('#actiontypeselect').val(activeactiontype);
						}

					}

					break;

			}
			break;

		case 'grouping':
			enableDesignButtons();

			break;

		case 'kineticjs':
		case 'konvajs':
		case 'canvas':
			if (activeobject != null) {
				layer = activeobject.getLayer();
				actlayer = layer.getAttr('actionlayer');
				//			stage = layer.getStage();
				enableDesignButtons();
				treecontainer.jstree('deselect_all');
				var id = activeobject.id();
				treecontainer.jstree('select_node', id);
				$('#actiontypeselect').empty();
				$('#actiontypeselect').append(makeActionTypeOptions(activeobject));
				//remember last actiontype
				var opts = $('#actiontypeselect option');
				var values = $.map(opts, function (opt) {
					return ($(opt).val());
				});
				//console.log(values);
				if ($.inArray(activeactiontype, values) != -1) {
					$('#actiontypeselect').val(activeactiontype);
				}

			}
			break;

	}
}



function createStage(stagestate) {
	/**
	* Creates a new stage when a view is created
	*/
	var hwratio = stagestate.screenheight / stagestate.screenwidth;
	var vh = sh - 4;
	var vw = sw - 4;
	var vhwratio = vh / vw;
	if (vhwratio > hwratio) {
		var stw = vw;
		var sth = Math.round(vw * hwratio);
	}
	else {
		var sth = vh;
		var stw = Math.round(vh / hwratio);
	}
	$('#' + stagestate.container).height(sth);
	$('#' + stagestate.container).width(stw);

	if (stagestate.id == 'none') { stagestate.id = UniqueId(); }

	var newstage = new Konva.Stage({
		container: stagestate.container,
		id: stagestate.id,
		name: stagestate.name,
		width: stw,
		height: sth
	});

	stagestate.txscale = stagestate.screenwidth / stw;
	newstage.setAttr('state', stagestate);
	return newstage;
}

function createLayer(layerstate) {
	/**
	* Creates a new layer on the active stage/view
	*/
	if (layer != null) { layer.clear(); }
	if (layerstate.id == 'none') {
		layerstate.id = UniqueId();
		console.log("generating new layer id " + layerstate.id);
	}
	var newlayer = new Konva.Layer({ name: layerstate.name, id: layerstate.id });
	newlayer.setAttr('state', layerstate);
	stage.add(newlayer);

	// create an action layer for this layer
	var actionlayer = new Konva.Layer({ name: "act_" + layerstate.name, id: UniqueId() });
	actstage.add(actionlayer);
	actionlayer.setAttr('parentlayer', newlayer);
	newlayer.setAttr('actionlayer', actionlayer);
	if (openedproject == false) {
		makeActionBox(actionlayer);
	}
	makeLayerAnimation(actionlayer);


	return newlayer;

}

function removeProject(pj) {
	/**
	* Remove a project from the database by making an ajax call to nodeio
	*/
	var projid = pj.getAttribute('data-projid');
	var projstatestr = pj.getAttribute('data-project');
	var projdetail = JSON.parse(projstatestr);
	var ans = confirm('Are you sure you want to remove the project ' + projdetail.name + '?');
	if (ans == true) {
		$.ajax({
			url: hostaddr + "/removeproject",
			type: "GET",
			data: { id: projid }
		})
			.done(function () {
				//alert( "success" );
				loadProjects();
			})
			.fail(function () {
				alert("error");
			})
			.always(function () {
				//alert( "complete" );


			});
	}

}

function newProject() {
	/**
	* Create a new project and instantiate the tree
	*/
	var cdate = (new Date()).toLocaleDateString();
	project = {
		id: 'project',
		name: 'Project',
		creator: 'unknown',
		type: 'Project',
		folder: null,
		createdate: cdate,
		lastdate: cdate,
		screenheight: 1080,
		screenwidth: 1920,
		layers: [],
		presentevents: [],
		starteventviews: [],
		groups: []
	};

	clearActiveObject();
	stage.clear();
	stage.destroyChildren();
	layer = null;
	actstage.clear();
	actstage.destroyChildren();
	projectopened = false;
	eventliststates = [];
	makeTree(project);
	disableDesignButtons();
	last_saved_project_hash = null;
}


/**
 * Given source data about a layer with its state + children, introduce it into the design.
 *
 */
function populateLayer(params) {

	var projectId = params.projectId || null,
		layerstate = params.layerstate || {},
		resetIds = params.resetIds || false,
		name = params.name || null;

	var idLookup = {};

	if (name && name.length > 0) {
		layerstate.name = name;
	}

	if (resetIds) {
		var oldId = layerstate.id + "";
		idLookup[oldId] = null;
		layerstate.id = 'none';
	}

	var newlayer = createLayer(layerstate);

	if (resetIds) {
		idLookup[oldId] = newlayer.id();
	}

	stage.add(newlayer);
	layer = newlayer;

	nodelist.push({ parentid: projectId, nodeid: newlayer.id(), nodestate: layerstate });

	var objects = layerstate.children;
	for (var k = 0; k < objects.length; k++) {

		var objstate = objects[k];

		if (resetIds) {
			var oldId = objstate.id + "";
			idLookup[oldId] = null;
			objstate.id = 'none';
		}

		if (objstate.type == 'Group') {
			var obj = newgroupobj(true, false, objstate);
			layer.add(obj);
		} else {
			var obj = newobj(true, objstate);
			layer.add(obj);
		}

		if (resetIds) {
			idLookup[oldId] = obj.id();
		}

		layer.draw();
		nodelist.push({ parentid: newlayer.id(), nodeid: obj.id(), nodestate: objstate });
	}

	//add actions for the object
	actlayer = layer.getAttr('actionlayer');

	var eventlists = layerstate.eventlists;

	for (var m = 0; m < eventlists.length; m++) {
		var eventliststate = eventlists[m];
		if (resetIds) {
			var newId = UniqueId();
			idLookup[eventliststate.id] = newId;
			eventliststate.id = newId;
		}
		var evobj = makeEventList(eventliststate);
		actlayer.add(evobj);
		if (evobj.getAttr('state').name == 'actionbox') {
			actlayer.setAttr('actionbox', evobj);
		}

		// @TODO: Only do this on initial proj loading.
		if ( ! resetIds) {
			for (var ai = 0; ai < eventliststate.actions.length; ai++) {
				var actstate = eventliststate.actions[ai];
				// if (resetIds) {
				// 	actstate.id = "none";
				// 	actstate.parentobjectid = idLookup[actstate.parentobjectid];
				// }
				var actobj = actionobj(actstate, evobj);
			}
		}
	}

	if (resetIds) {

		var newstartstate = layerstate.startstate + "";

		$.each(idLookup, function(k, v) {
			var regex = new RegExp(k, "g");
			newstartstate = newstartstate.replace(regex, v);
		});

		var layerState = newlayer.getAttr('state');
		layerState.startstate = newstartstate;
		newlayer.setAttr('state', layerState);
	}

	return {
		layer: newlayer,
		id: newlayer.id(),
		state: newlayer.getAttr('state'),
	};
}


function populateProject(proj) {
	/**
	* Populate the project with objects according to its projectstate
	* Builds a nodelist of all the objects in the project for fetchnextProjectnode function to operate on
	*/
	var layers = proj.layers;
	for (var j = 0; j < layers.length; j++) {
		populateLayer({
			projectId: proj.id,
			layerstate: layers[j],
		});
	}
	//info to generate presentscreen views and presentevents
	eventliststates = [];
	Array.prototype.push.apply(eventliststates, proj.presentevents);

	stage.clear();
	layer.draw();
	updateEventSwimList();
}

function fetchnextProjectNode() {
	/**
	* Called by tree when nodes are created during opening of project
	* allows nodes to be added recursively on nodecreate event of tree to allow each operation to complete
	* before new node is added
	*/

	if (listcounter < nodelist.length) {
		var nodeinfo = nodelist[listcounter];
		listcounter += 1;
		return nodeinfo;
	}
	else {
		openedproject = false; // when done
		listcounter = 0;
		return null;
	}
}


function openProject(projectId) {
	/**
	* Opens a project and builds a tree from nodes in project state using nodelist, makeTree and populateProject
	* using event driven sequence
	*/

	// var projid = pj.getAttribute('data-projid');
	showLoading('Loading project...');

	$.getJSON(hostaddr + "/getproject/" + projectId, function (data) {

		$("#projects").empty();

		openedproject = true;
		projectopened = true;

		clearActiveObject();
		stage.clear();
		stage.destroyChildren();
		actstage.clear();
		actstage.destroyChildren();

		project = data.json;
		project.id = projectId;
		project.folder = data.folder === null ? '' : data.folder;
		eventliststates = [];
		Array.prototype.push.apply(eventliststates, project.presentevents);
		nodelist = [];
		populateProject(project);
		listcounter = 0;

		makeTree(project);

		stageDims();

		last_saved_project_hash = null;

		activateModal();

		setTimeout(function () {
			if (layer == null) {
				layer = stage.getLayers()[0];
			}
			layer.draw();
			var id = layer.id();
			treecontainer.jstree('select_node', id);
			txReady('openready');
		}, 500);
	});

}


function packageProject() {
	/**
	* packages a project to a json object for saving or transmission to screens
	*/
	var ldate = (new Date()).toLocaleDateString();
	var layerstatearr = new Array();
	var eventliststatearr = new Array();
	var actionstatearr = new Array();
	var objstatearr = new Array();


	var projlayers = stage.getLayers().toArray();
	layerstatearr = [];
	for (var vch = 0; vch < projlayers.length; vch++) {
		var vlayer = projlayers[vch];
		var layerstate = vlayer.getAttr('state');

		var lchildren = vlayer.getChildren().toArray();
		objstatearr = [];
		for (var lch = 0; lch < lchildren.length; lch++) {
			var lchild = lchildren[lch];
			if (lchild.name() != 'Selector') {  //get rid of selector before saving
				var childstate = lchild.getAttr('state');
				objstatearr.push(childstate);
			}
		}
		layerstate.children = objstatearr;

		var actionlayer = vlayer.getAttr('actionlayer');
		var layereventlists = actionlayer.find('.eventgroup');
		eventliststatearr = [];
		for (var evi = 0; evi < layereventlists.length; evi++) {
			var evlistactions = layereventlists[evi].find('.action');
			actionstatearr = [];
			for (var ai = 0; ai < evlistactions.length; ai++) {
				var actstate = evlistactions[ai].getAttr('state');
				actionstatearr.push(actstate);
			}
			var evstate = layereventlists[evi].getAttr('state');
			evstate.actions = actionstatearr;
			eventliststatearr.push(evstate);

		}
		layerstate.eventlists = eventliststatearr;



		layerstatearr.push(layerstate);
	}

	var projstate = {
		id: project.id,
		name: project.name,
		creator: project.creator,
		type: 'Project',
		createdate: project.createdate,
		lastdate: ldate,
		screenwidth: project.screenwidth,
		screenheight: project.screenheight,
		layers: layerstatearr,
		presentevents: eventliststates,
		starteventviews: project.starteventviews,
		groups: project.groups
	};


	return projstate;
}


function packageLayer(vlayer) {

	var layerstate = vlayer.getAttr('state');
	var lchildren = vlayer.getChildren().toArray();

	var objstatearr = [];
	for (var lch = 0; lch < lchildren.length; lch++) {
		var lchild = lchildren[lch];
		if (lchild.name() != 'Selector') {  //get rid of selector before saving
			var childstate = lchild.getAttr('state');
			objstatearr.push(childstate);
		}
	}
	layerstate.children = objstatearr;

	var actionlayer = vlayer.getAttr('actionlayer');
	var layereventlists = actionlayer.find('.eventgroup');
	var eventliststatearr = [];
	for (var evi = 0; evi < layereventlists.length; evi++) {
		var evlistactions = layereventlists[evi].find('.action');
		actionstatearr = [];
		for (var ai = 0; ai < evlistactions.length; ai++) {
			var actstate = evlistactions[ai].getAttr('state');
			actionstatearr.push(actstate);
		}
		var evstate = layereventlists[evi].getAttr('state');
		evstate.actions = actionstatearr;
		eventliststatearr.push(evstate);

	}

	layerstate.eventlists = eventliststatearr;

	console.log(layerstate);
	console.log(eventliststates);

	return layerstate;
}


function packagePresentEvents(layerId) {
	$.map(present)
}


/**
* Saves a project to the database with an ajax call to nodeio
*
*/
function saveProject() {

	// Skip this if we're already in the process of saving.
	if (saving_project === true) return;

	var ldate = (new Date()).toLocaleDateString();
	var projstate = packageProject();
	var projectjson = JSON.stringify(projstate);

	// Create hash of project data to work out if it has changed since the last save
	var project_hash = md5(project.id + projectjson),
		is_different = (project_hash != last_saved_project_hash);

	if ( ! is_different) {
		console.log("Project not changed - not saving");
		return;
	}

	saving_project = true;

	$.ajax({
		url: hostaddr + "/addproject",
		type: "POST",
		data: { id: project.id, name: project.name, folder: project.folder, cdate: project.createdate, ldate: ldate, creator: project.creator, state: projectjson }
	}).done(function (resp) {
		//alert( "success" );
		//console.log(resp);
		// console.log("Saved project");
	})
	.success(function(resp) {
		project.id = resp;
		last_saved_project_hash = md5(project.id + projectjson);
		console.log("Saved project successfully.");
	})
	.fail(function () {
		alert("error");
	})
	.always(function () {
		saving_project = false;
		//alert( "complete" );
	});

}

function saveasnewProject() {
	project.id = 'project';
	var cdate = (new Date()).toLocaleDateString();
	project.createdate = cdate;
	saveProject();
}


function loadProjects() {
	/**
	* List project icons in the tree panel when opening a project.  Lists projects returned from database after ajax call to nodeio.
	*/
	$("#tree").empty();
	$("#projects").empty();

	$.getJSON(hostaddr + "/getprojects", function (data) {

		if ($('#projects').data('browser')) {
			$('#projects').data('browser').setItems(data).render();
		} else {
			$('#projects').data('browser', new ProjectBrowser('#projects', data));
		}
	});
}


function addLayer() {
	/**
	* Add a new layer and a layer treenode
	*/
	if (selectednode != null && selectednode.type == 'Project') {
		//var viewnum = views.indexOf(activeobject)+1;
		var childlayers = stage.getLayers().toArray();
		var nameindex = 1;
		var nameused = true;
		while (nameused == true) {
			nameused = false;
			for (var i = 0; i < childlayers.length; i++) {
				child = childlayers[i];
				if (child.name() == 'layer' + nameindex.toString()) { nameused = true; }
			}
			if (nameused == true) { nameindex++; }

		}
		var layername = 'layer' + nameindex.toString();
		layerstate = { name: layername, type: 'Layer', id: 'none' };
		layer = createLayer(layerstate);  // create and make active layer
		actlayer = layer.getAttr('actionlayer');

		if (objSelector == null) {
			objSelector = new objectSelector();
		}
		else {
			clearActiveObject();
		}

		layer.add(objSelector.objSelGroup);

		addTreeNode(project.id, layer.id(), layerstate);

		txLayers();
		//console.log(layer);
	}
}

function deleteLayer() {
	/**
	* Delete a layer and its objects as well as their tree nodes
	*/
	if (activeobject != null && selectednode.type == 'Layer') {
		var ans = confirm('Are you sure you want to delete this layer and its contents?');
		if (ans == true) {
			var dellayer = layer;
			var dchildren = dellayer.getChildren().toArray();
			for (var i = 0; i < dchildren.length; i++) {
				var dchild = dchildren[i];
				var id = dchild.id();
				treecontainer.jstree('delete_node', id);
				dchild.destroy();
			}

			//delete the actionlayer associated with this layer
			var alayer = dellayer.getAttr('actionlayer');
			alayer.destroyChildren();
			alayer.destroy();

			//make sure there is a blank layer left in view
			if (stage.getChildren().toArray().length > 1) {
				treecontainer.jstree('select_node', selectednode.parent);
				treecontainer.jstree('delete_node', dellayer.id());
				dellayer.destroy();
				layer = stage.getChildren().toArray()[0];
			}

			if (objSelector == null) {
				objSelector = new objectSelector();
			}
			else {
				clearActiveObject();
			}

			txLayers();
		}
	}

}

function duplicateLayer() {

	if (activeobject == null || selectednode.type != 'Layer') {
		return;
	}

	var layerData = JSON.stringify(packageLayer(layer));
	// console.log(layerData);
	importLayer(JSON.parse(layerData));
	return;
}


function showImportLayer() {
	location.hash = "#modal_layer_import";
	$("#modal_layer_import").find(".layer-data").focus();
}

function showExportLayer() {
	if (layer == null) {
		alert("Please select a layer.");
		return;
	}

	location.hash = "#modal_layer_export";
	var layerData = JSON.stringify(packageLayer(layer));
	layerData = btoa(layerData);
	$("#modal_layer_export").find(".layer-data").val(layerData).focus().select();
}

function uiHandleImport() {
	var $textarea = $("#modal_layer_import").find("textarea");
	var layerData = $textarea.val();
	if (layerData.length === 0) {
		alert("No data to import.");
		return;
	}

	layerData = atob(layerData);

	try {
		var parsed = JSON.parse(layerData);
	} catch (e) {
		alert("There was an error in the pasted data: " + e);
		return;
	}

	importLayer(parsed);
	$textarea.val("");
	location.hash = "#";
}

function uiHandleExportCopy() {
	$("#modal_layer_export").find(".layer-data").focus().select();
	document.execCommand('copy');
}

function exportLayer() {

	if (activeobject == null || selectednode.type != 'Layer') {
		return;
	}

	var layerData = JSON.stringify(packageLayer(layer));

	$("<textarea>").val(layerData).appendTo($("body"));

}


function generateLayerName(layerData) {
	var name = layerData.name;
	var childlayers = stage.getLayers().toArray();
	var nameindex = 1;
	var nameused = true;
	while (nameused == true) {
		nameused = false;
		for (var i = 0; i < childlayers.length; i++) {
			child = childlayers[i];
			if (child.name() == name + nameindex.toString()) { nameused = true; }
		}
		if (nameused == true) { nameindex++; }

	}
	var layername = name + nameindex.toString();
	return layername;
}


function importLayer(layerData) {

	openedproject = true;

	listcounter = nodelist.length+1;

	var res = populateLayer({
		projectId: project.id,
		layerstate: layerData,
		resetIds: true,
		name: generateLayerName(layerData),
	});

	if (objSelector == null) {
		objSelector = new objectSelector();
	} else {
		clearActiveObject();
	}

	// console.log(res);
	// console.log(nodelist);

	res.layer.add(objSelector.objSelGroup);

	addTreeNode(project.id, res.layer.id(), res.state);
	txLayers();
	updateEventSwimList();
}


/**
 * Project Export/Import
 *
 */


function showExportProject() {

	if ( ! projectopened) {
		alert('Please open a project first.');
		return;
	}

	var projectId = parseInt(project.id, 10);
	if (isNaN(projectId)) {
		alert('Project must be saved before it can be exported.');
		return;
	}

	activateModal('projectExport');
	$("[data-modal='projectExport'] .content").html("<p>Processing...</p>");

	$.ajax({
		url: hostaddr + '/export_project/' + project.id,
		type: 'POST'
	})
	.success(function(res) {
		$.event.trigger({
			type: 'export_complete',
			res: res
		});
	})
	.fail(function(res) {
		$.event.trigger({
			type: 'export_complete',
			res: res
		});
	});
}


function showImportProject() {
	activateModal('projectImport');
}


function uiHandleProjectUpload() {

	var fdata = new FormData();
	var fileid = document.getElementById("projectfile");
	var files = fileid.files;

	for (var i=0;i<files.length;i++) {
		var ifile = files[i];
		fdata.append("projectfile", ifile);
	}

	$.ajax({
		url: hostaddr + '/import_project',
		type: 'POST',
		data: fdata,
		processData: false,  // tell jQuery not to process the data
		contentType: false,  // tell jQuery not to set contentType
	})
	.success(function(res) {
		console.log(res);
		$.event.trigger({
			type: 'import_complete',
			res: res
		});
	})
	.fail(function(res) {
		var data = res.responseJSON;
		$.event.trigger({
			type: 'import_complete',
			res: data
		});
	});
}


function makeObjectListOptions() {
	var objtypes = ['Rect', 'Ellipse', 'RegularPolygon', 'Star', 'Ring', 'Text', 'Line', 'PolyLine', 'CurvedArrow'];
	var htmlstr = '';
	for (var i = 0; i < objtypes.length; i++) {
		var objtype = objtypes[i];
		htmlstr = htmlstr + '<option value="' + objtype + '">' + objtype + '</option>';
	}
	return htmlstr;
}

function enableDesignButtons() {
	/**
	* Manage the activation of the buttons above the design space
	*/
	//console.log(tgroupindicator);
	if (activeobject != null) {
		var state = activeobject.getAttr('state');

		if (state.type == 'Group' && tgroupindicator == null) {
			$('#ungroupbutton').prop('disabled', false);

		}
		else {
			$('#ungroupbutton').prop('disabled', true);
		}
	}

	if (tempgroup.length > 1) {
		$('#groupbutton').prop('disabled', false);
	}
	else {
		$('#groupbutton').prop('disabled', true);
	}

	if (tgroupindicator == null) {
		$('#copybutton').prop('disabled', false);
		$('#deletebutton').prop('disabled', false);
		//$('#arrowbutton').prop('disabled',false);
	}
	else {
		$('#copybutton').prop('disabled', true);
		$('#deletebutton').prop('disabled', true);
		//$('#arrowbutton').prop('disabled',true);
	}

	$('#createbutton').prop('disabled', false);
	$('#objecttypeselect').prop('disabled', false);
	$('#multiselectbutton').prop('disabled', false);
	$('#txscrbutton').prop('disabled', false);
	$('#showallbutton').prop('disabled', false);
	$('#playlist').show();
}

function disableDesignButtons() {
	/**
	* Disable all the design buttons
	*/
	$('#copybutton').prop('disabled', true);
	$('#deletebutton').prop('disabled', true);
	//$('#arrowbutton').prop('disabled',true);
	$('#groupbutton').prop('disabled', true);
	$('#ungroupbutton').prop('disabled', true);
	$('#multiselectbutton').prop('disabled', true);
	if (layer == null) {
		$('#showallbutton').prop('disabled', true);
		$('#txscrbutton').prop('disabled', true);
		$('#createbutton').prop('disabled', true);
		$('#objecttypeselect').prop('disabled', true);
		$('#playlist').hide();
	}
	else {
		$('#showallbutton').prop('disabled', false);
		$('#txscrbutton').prop('disabled', false);
		$('#createbutton').prop('disabled', false);
		$('#objecttypeselect').prop('disabled', false);
		$('#playlist').show();
	}
}

function togMultiselect() {
	/**
	* Toggle the multiselect mode
	*/
	if (ctrlkey == false) {
		$('#multiselectbutton').css("background-color", "#bbeebb");
		ctrlkey = true;
	}
	else {
		$('#multiselectbutton').css("background-color", "#eeaa88");
		ctrlkey = false;
		clearTempGroup();
	}
}

function togShowall() {
	/**
	* show all mode that makes all objects in designspace visible with 50% opacity
	*/
	if (showall == false) {
		if (layer != null) {
			var lchildren = layer.getChildren().toArray();
			for (var lch = 0; lch < lchildren.length; lch++) {
				var lchild = lchildren[lch];
				if (lchild.name() != 'Selector') {  //get rid of selector before saving
					lchild.visible(true);
					lchild.opacity(0.5);
				}
			}
			layer.draw();
			showall = true;
			$('#showallbutton').text('restore');
		}
	}
	else {
		if (layer != null) {
			var lchildren = layer.getChildren().toArray();
			for (var lch = 0; lch < lchildren.length; lch++) {
				var lchild = lchildren[lch];
				if (lchild.name() != 'Selector') {  //get rid of selector before saving
					var state = lchild.getAttr('state');
					lchild.visible(state.visible);
					lchild.opacity(state.opacity);
				}
			}
			layer.draw();
			showall = false;
			$('#showallbutton').text('show all');
		}

	}
}


function togFullscreen() {
	/**
	* Toggle full screen mode
	*/
	var element = document.documentElement;

	if (fullscreen == false) {
		// These function will not exist in the browsers that don't support fullscreen mode yet,
		// so we'll have to check to see if they're available before calling them.
		if (element.RequestFullScreen) {
			element.RequestFullScreen();
			fullscreen = true;
		}
		else if (element.mozRequestFullScreen) {
			element.mozRequestFullScreen();  //Mozilla
			fullscreen = true;
		}
		else if (element.webkitRequestFullScreen) {
			element.webkitRequestFullScreen();  //Chrome, Safari
			fullscreen = true;
		}
	}
	else {
		if (document.cancelFullScreen) {
			document.cancelFullScreen();
			fullscreen = false;
		}
		else if (document.mozCancelFullScreen) {
			document.mozCancelFullScreen();
			fullscreen = false;
		}
		else if (document.webkitCancelFullScreen) {
			document.webkitCancelFullScreen();
			fullscreen = false;
		}
	}


}

function setCastmode() {
	castmode = $('#castaction').prop('checked');
}


function stageDims() {
	return stageDimsV2();
}


function stageDimsV2() {

	// Set the width/height of the stage container
	var hwratio = project.screenheight / project.screenwidth;
	var vh = sh - 4;
	var vw = sw - 4;
	var vhwratio = vh / vw;
	if (vhwratio > hwratio) {
		var stw = vw;
		var sth = Math.round(vw * hwratio);
	} else {
		var sth = vh;
		var stw = Math.round(vh / hwratio);
	}

	$('#designstage').height(sth);
	$('#designstage').width(stw);
	stage.width(stw);
	stage.height(sth);
	// txscale = project.screenwidth / stw;

	var ratio = 0,
		maxWidth = stw,
		maxHeight = sth,
		width = project.screenwidth,
		height = project.screenheight;

	if (width > maxWidth) {
		ratio = maxWidth / width;
		var newWidth = maxWidth;
		var newHeight = height * ratio;
		stage.width(newWidth);
		stage.height(newHeight);
		height = height * ratio;
		width = width * ratio;
	}

	if (height > maxHeight) {
		ratio = maxHeight / height;
		var newHeight = maxHeight;
		var newWidth = width * ratio;
		stage.width(newWidth);
		stage.height(newHeight);
		width = width * ratio;
	}

	var scale = {
		x: newWidth / project.screenwidth,
		y: newHeight / project.screenheight
	};

	stage.scale(scale);
	stage.draw();
}


function stageDimsV1() {
	var hwratio = project.screenheight / project.screenwidth;
	var vh = sh - 4;
	var vw = sw - 4;
	var vhwratio = vh / vw;
	if (vhwratio > hwratio) {
		var stw = vw;
		var sth = Math.round(vw * hwratio);
	}
	else {
		var sth = vh;
		var stw = Math.round(vh / hwratio);
	}
	$('#designstage').height(sth);
	$('#designstage').width(stw);

	stage.width(stw);
	stage.height(sth);
	txscale = project.screenwidth / stw;

}

/**
 * Set up the various panels in the screen according to the screen mode and size
 *
 */
function screenSetup() {

	var ww = $(window).width();
	var wh = $(window).height();
	$('#page').css({ 'height': Math.round(0.98 * wh).toString() + 'px' });
	$('#page').css({ 'width': Math.round(0.98 * ww).toString() + 'px' });
	var ph = $('#page').height();
	var pw = $('#page').width();

	var leftColumnWidth = 32;
	if (showLeftCol) {
		leftColumnWidth = Math.round(0.3 * pw);	//.toString() + "px";
		$("#leftcolumn").css({ "display": "block" });
		$("#showleft").hide();
	} else {
		$("#leftcolumn").css({ "display": "none" });
		$("#showleft").show();
	}

	$('#leftcolumn').css({ 'height': Math.round(1.0 * ph).toString() + 'px' });
	$('#leftcolumn').css({ 'width': leftColumnWidth.toString() + "px" });
	$('#rightcolumn').css({ 'left': leftColumnWidth.toString() + "px" });
	$('#rightcolumn').css({ 'height': Math.round(1.0 * ph).toString() + 'px' });

	$('#rightcolumn').css({ 'width': Math.round(pw - leftColumnWidth).toString() + "px" });

	$('#treespace').css({ 'height': Math.round(0.5 * ph).toString() + 'px' });
	$('#designspace').css({ 'height': Math.round(0.7 * ph - 10).toString() + 'px' });
	//$('#designspace').height(Math.round(0.7*ph-10));
	$('#libpane').css({ 'height': Math.round(0.3 * ph - 110).toString() + 'px' });
	$('#actionpane').css({ 'height': Math.round(0.3 * ph - 110).toString() + 'px' });
	$('#actionpane').css({ 'width': Math.round(pw - leftColumnWidth - 2).toString() + 'px' });
	$('#propedit').css({ 'height': Math.round(0.5 * ph - 48).toString() + 'px' });
	libw = $('#libpane').width();
	libh = $('#libpane').height();
	actw = $('#actionpane').width();
	acth = $('#actionpane').height();
	sh = $('#designspace').height();
	sw = $('#designspace').width();

}

function resizeStages() {
	/**
	* Resize the stages to fit the new screen container sizes
	*/
	objstage.clear();
	objlayer.draw();
	actstage.clear();
	if (actlayer != null) {
		actlayer.draw();
	}

}


function toggleSidebar(state) {
	showLeftCol = state;
	screenSetup();
}


function getLayerObjects(sendlayer) {
	/**
	* Gets the child states on layer excluding selector. Returns an array of child states
	*/
	var layerstate = sendlayer.getAttr('state');

	var lchildren = sendlayer.getChildren().toArray();
	objstatearr = [];
	for (var lch = 0; lch < lchildren.length; lch++) {
		var lchild = lchildren[lch];
		if (lchild.name() != 'Selector') {  //ignore selector
			var childstate = lchild.getAttr('state');
			objstatearr.push(childstate);
		}
	}
	return objstatearr;

}

function txStartViews(startviews) {
	/**
	* Sends the start states of layers in the views attached to the startevent to the screens that are listening for their names e.g.screen1
	* Receives the startviews object from from presentscreen
	*/
	// console.log("txStartViews");
	// console.log(startviews);
	var affectedlayers = [];
	if (stage != null && layer != null) {
		for (var pei = 0; pei < startviews.length; pei++) {
			var peview = startviews[pei];
			var scrname = peview.viewstate.name;
			var layerid = peview.layerid;
			if (layerid != 'none') {
				var sendlayer = stage.find('#' + layerid)[0];
				if (sendlayer != null) {
					affectedlayers.push(sendlayer);
					var layerstate = sendlayer.getAttr('state');
					var startstate = JSON.parse(layerstate.startstate);
					// console.log(sendlayer);
					// console.log(layerstate);
					// console.log(startstate);
					var screenstate = { screenwidth: project.screenwidth, screenheight: project.screenheight, txscale: txscale, viewstate: peview.viewstate, layerchildren: startstate, layeractions: [] };
					var scrcommand = { view: scrname, scrtxmsg: { command: 'update', info: screenstate } };
					var scrjson = JSON.stringify(scrcommand);
					socket.emit('screenmsg', scrjson);

				}
			}
		}
		setTimeout(function () {	//delay to allow screenmesgs to go
			//set layers to start startstates
			for (var li = 0; li < affectedlayers.length; li++) {
				var aflayer = affectedlayers[li];
				var sstate = JSON.parse(aflayer.getAttr('state').startstate);
				if (sstate != null) {
					for (var k = 0; k < sstate.length; k++) {
						var objstate = sstate[k];
						var obj = aflayer.find('#' + objstate.id)[0];
						if (obj != null) {
							//console.log(obj,objstate);
							if (objstate.type == 'Group') {
								updateGroupState(obj, objstate);
							}
							else {
								updateState(obj, objstate);
							}
						}
					}
					aflayer.draw();
				}
			}
		}, 500);
	}

}

function txViews(pevindex) {
	/**
	* Sends the present event state to the screens that are listening for their names e.g.screen1
	* Receives the presentevent index from presentscreen
	*/
	// console.log("txViews");
	// console.log(pevindex);
	// console.log(eventliststates);
	if (stage != null && layer != null) {
		var pevstate = eventliststates[pevindex];
		// console.log("pevstate");
		// console.log(pevstate);
		if (pevstate === undefined) {
			console.warn("txViews(): No knowledge of event with index " + pevindex + ", skipping.");
			return;
		}
		console.log("txViews(): Sending event index " + pevindex + ". (" + pevstate.group + " / " + pevstate.name + ")");
		var peviews = pevstate.peviews;
		for (var pei = 0; pei < pevstate.peviews.length; pei++) {
			var peview = peviews[pei];
			var scrname = peview.viewstate.name;
			var layerid = peview.layerid;
			if (layerid != 'none') {
				var sendlayer = stage.find('#' + layerid)[0];
				var actionlayer = sendlayer.getAttr('actionlayer');
				var pevactions = peview.actions;
				//console.log(pevactions);
				actionstatearr = [];
				for (var ai = 0; ai < pevactions.length; ai++) {
					var actid = pevactions[ai].id;
					var act = actionlayer.find('#' + actid)[0];
					if (act) {
						var actstate = act.getAttr('state');
						actionstatearr.push(actstate);
					}
				}
				var layerobjs = getLayerObjects(sendlayer);
				var screenstate = { screenwidth: project.screenwidth, screenheight: project.screenheight, txscale: txscale, viewstate: peview.viewstate, layerchildren: layerobjs, layeractions: actionstatearr };
				var scrcommand = { view: scrname, scrtxmsg: { command: 'update', info: screenstate } };
				var scrjson = JSON.stringify(scrcommand);
				socket.emit('screenmsg', scrjson);
			}
		}

	}

}

function findPELayer(layerid, layerstates) {
	/**
	* Called by compileViews to find a layer in a layerstates list
	*/
	var found = false;
	var i = 0;
	var index = -1;
	while (found == false && i < layerstates.length) {
		if (layerid == layerstates[i].layerid) {
			found = true;
			index = i;
		}
		i = i + 1;
	}
	return index;
}

function findobjinPELayer(objid, layerobjstates) {
	/**
	* Called by compileViews to find an object layer in a layerstate list
	*/
	var found = false;
	var i = 0;
	var index = -1;
	while (found == false && i < layerobjstates.length) {
		if (objid == layerobjstates[i].id) {
			found = true;
			index = i;
		}
		i = i + 1;
	}
	return index;
}

function findLayerImages(objstates) {
	/**
	* Finds all image objects on a layer
	*/
	imgobjs = [];
	for (var chi = 0; chi < objstates.length; chi++) {
		var obj = objstates[chi];
		if (obj.type == 'Group') {
			var children = obj.children;
			findLayerImages(children);
		}
		else {
			if (obj.type == 'Image') {
				imgobjs.push(obj);
			}
		}

	}
	return imgobjs;
}

/**
 * Finds all sound objects on a layer
 *
 */
function findLayerAudio(objstates) {
	soundobjs = [];
	for (var chi = 0; chi < objstates.length; chi++) {
		var obj = objstates[chi];
		if (obj.type == 'Group') {
			var children = obj.children;
			findLayerAudio(children);
		} else {
			if (obj.type == 'Audio') {
				soundobjs.push(obj);
			}
		}
	}
	return soundobjs;
}

/**
 * Parse the startstate objects whilst looking for click events to attach to them.
 * Click events might not be included in the startstate JSON.
 *
 * Look for objects in the layer children. If obj has "event" prop, store it.
 * Look at all objs in startstate - if there is a matching obj that has event, update it.
 *
 */
function populateEvents(params) {

	var startstate = params.startstate,
		objs = params.children,
		obj;

	var events = {};

	for (var i = 0; i < objs.length; i++) {
		obj = objs[i];
		if (obj.event && obj.event.length > 0) {
			events[ obj.id ] = obj.event;
		}
	}

	for (var i = 0; i < startstate.length; i++) {
		obj = startstate[i];
		if (events && events[obj.id]) {
			obj.event = events[obj.id];
		}
	}

	return startstate;
}

function compileViews() {
	var pelayerobjstates = [];  // snapshot state of objects and actions on each layer on start of each presentevent
	var playimages = [];
	var playsounds = [];
	if (stage != null && layer != null) {
		var layers = stage.getLayers().toArray();

		//snapshot at start presentevent taken from layer startstates
		var layerstates = [];
		for (var li = 0; li < layers.length; li++) {
			var stlayer = layers[li];
			var layerName = stlayer.getAttr('name');
			var layerstate = stlayer.getAttr('state').startstate;

			if (layerstate == null || layerstate == undefined) {
				alert('Layer startstates are not defined on "' + layerName + '".');
				return;
			}

			var startstate = null;
			try {
				startstate = JSON.parse(layerstate);
			} catch (e) {
				alert('Layer startstates are not defined on "' + layerName + '".');
				return;
			}

			var layerobjs = populateEvents({
				'startstate': startstate,
				'children': stlayer.getAttr('state').children,
			});

			// console.log(layerobjs);
			//if the objects are image objects we need to package the image resources as well and change the image paths

			var playimgs = findLayerImages(layerobjs);
			//console.log(playimgs);
			for (var imn = 0; imn < playimgs.length; imn++) {
				var imgobj = playimgs[imn];
				var imgfilename = imgobj.path.replace(/resources\//, '');
				imgobj.path = 'playlists/' + project.name + '/images/' + imgfilename;
				playimages.push(imgfilename);
			}

			var playsnds = findLayerAudio(layerobjs);
			// console.log(playsnds);
			for (var sndn = 0; sndn < playsnds.length; sndn++) {
				var sndobj = playsnds[sndn];
				var audiofilename = sndobj.src.replace(/resources\//, '');
				sndobj.src = 'playlists/' + project.name + '/audio/' + audiofilename;
				playsounds.push(audiofilename);
			}

			var lstate = { layerid: stlayer.id(), objstates: layerobjs, layeractions: [] };  //objstates are object states and layeractions are action definitions/states for each action applied on that presentevent
			layerstates.push(lstate);
		}
		pelayerobjstates.push(layerstates);
		// snapshots for each presentevent following first one
		for (var pevindex = 0; pevindex < eventliststates.length; pevindex++) {
			if (pevindex < eventliststates.length - 1) {
				var origlayerobjstate = JSON.stringify(pelayerobjstates[pevindex]);
				var newlayerobjstate = JSON.parse(origlayerobjstate);			//clone layerstates from previous one
			}
			var layerstates = [];
			var pevstate = eventliststates[pevindex];
			var peviews = pevstate.peviews;
			for (var pei = 0; pei < pevstate.peviews.length; pei++) { //get actions for the event
				var peview = peviews[pei];
				// console.log(peview);
				var scrname = peview.viewstate.name;
				var layerid = peview.layerid;
				var sendlayer = stage.find('#' + layerid)[0];
				var layerexists = (sendlayer !== undefined);
				if (layerid != 'none' && layerexists) {
					var actionlayer = sendlayer.getAttr('actionlayer');
					var pevactions = peview.actions;
					// console.log(pevactions);
					actionstatearr = [];
					for (var ai = 0; ai < pevactions.length; ai++) {
						var actid = pevactions[ai].id;
						var act = actionlayer.find('#' + actid)[0];
						if (act) {
							var actstate = act.getAttr('state');
							actionstatearr.push(actstate);
						}
					}
					var layerind = findPELayer(layerid, pelayerobjstates[pevindex]);
					(pelayerobjstates[pevindex][layerind]).layeractions = actionstatearr;  //add actionstates for layer

					//get obj states at start of presentevent from previous snapshot and evolve states
					//only up to penultimate PE as next start state evolves from current one
					if (pevindex < eventliststates.length - 1) {

						//now apply actions to applicable objects in layer to get new layerstate snapshot

						var newlayerobjs = newlayerobjstate[layerind].objstates;
						for (var lai = 0; lai < actionstatearr.length; lai++) {
							var astate = actionstatearr[lai];
							var objind = findobjinPELayer(astate.parentobjectid, newlayerobjs);
							if (objind != -1) {
								var objstate = newlayerobjs[objind];
								var prop = actiontypes[astate.actiontype];
								if (prop == 'position') {
									objstate.x = astate.endstate.x;
									objstate.y = astate.endstate.y;
								}
								else {
									objstate[prop] = astate.endstate;
								}
							}
						}
					}

				}

			}
			if (pevindex < eventliststates.length - 1) {
				//console.log(newlayerobjstate);
				pelayerobjstates.push(newlayerobjstate);  //add new objectstates for next PE to snapshots
			}
		}

		var compiledViews = {
			screenwidth: project.screenwidth,
			screenheight: project.screenheight,
			txscale: txscale,
			layersnapshots: pelayerobjstates,
			pestates: eventliststates,
			playimages: playimages,
			playsounds: playsounds
		};

		var playlist = JSON.stringify(compiledViews);
		console.log('playlist length=' + playlist.length);

		$.ajax({
			url: hostaddr + "/saveplaylist",
			type: "POST",
			data: { projectname: project.name, playlist: playlist }
		})
		.done(function (resp) {
			alert("The playlist has been saved.");
			//console.log(resp);
		})
		.fail(function () {
			alert("Error saving playlist.");
		})
		.always(function () {
			//alert( "complete" );
		});

	}


}

function txReady(readystatus) //readystatus : newready or openready or notready
{
	var msg = JSON.stringify({
		command: 'designready',
		info: readystatus,
		project: {
			id: project.id,
			name: project.name,
			creator: project.creator,
			type: 'Project',
			createdate: project.createdate,
			lastdate: project.lastdate,
			screenwidth: project.screenwidth,
			screenheight: project.screenheight
		}
	});
	socket.emit('designmsg', msg);
}

function txLayers() {
	/**
	* Sends the layer info as an array of {layerid:id,layername:name}
	*/
	var layerinfo = [];
	var layers = stage.getLayers().toArray();
	for (var i = 0; i < layers.length; i++) {
		var layerid = layers[i].id();
		var layername = layers[i].name();
		layerinfo.push({ layerid: layers[i].id(), layername: layers[i].name() });
	}

	var msg = JSON.stringify({ command: 'layerinfo', info: layerinfo });
	socket.emit('designmsg', msg);


}


function txPEinfo() {
	var msg = JSON.stringify({ command: 'peinfo', info: { evl: eventliststates, sev: project.starteventviews, groups: project.groups } });
	socket.emit('designmsg', msg);
}

function txupdateAllEventListActions(pestates) {
	var msg = JSON.stringify({ command: 'updateAllPEventActions', info: pestates });
	socket.emit('designmsg', msg);
}
/*
function txLayerActions(actionobj,playlist) {

// Sends the actions that are played to the active view and layer
// The screen number is found from the view index of the active stage


	if (stage != null && layer != null) {
		var astate = actionobj.getAttr('state');
		var scrname = astate.viewname;
		var layername = layer.name();
		var scrcommand = {view:scrname,scrtxmsg:{command:'action',info:playlist}};
		var scrjson = JSON.stringify(scrcommand);
		socket.emit('screenmsg', scrjson);

	}
}
*/

function ioUpdate(respdata) {
	// console.log(respdata);
	var viewcommand = JSON.parse(respdata);
	var command = viewcommand.command;

	// console.log(viewcommand);
	switch (command) {
		case 'updateEventArr':
		eventliststates = viewcommand.info.pel;
			project.starteventviews = viewcommand.info.sev;
			project.groups = viewcommand.info.groups;
			// console.log("updateEventArr");
			// console.log(project);
			updateEventSwimList();
		break;

		case 'deleteEventList':
			var ind = viewcommand.info;
			deleteEventList(ind);
		break;

		case 'checkDesignScreen':
			console.log("checkDesignScreen");
			console.log(projectopened);
			console.log(layer);
			if (projectopened == true && layer != null) {
				txReady('openready');
			} else if (projectopened == false && layer != null) {
				deleteAllEventLists();
				txReady('newready');
			} else {
				deleteAllEventLists();
				txReady('notready');
			}
		break;

		case 'getLayerinfo':
			txLayers();
		break;

		case 'playPE':
			var ind = viewcommand.info;
			playPEEvents(ind);
		break;

		case 'startPE':
			var ind = viewcommand.info;
			startPEEvents(ind);
		break;

		case 'getPEinfo':
			txPEinfo();
		break;

		case 'castPEinfo':
			var ind = viewcommand.info;
			txViews(ind);
		break;

		case 'castStartinfo':
			var startviews = viewcommand.info;
			txStartViews(startviews);
		break;

		case "clickEvent":
			// data.info will be eventId to trigger.
			txClickEvent(viewcommand.info);
		break;
	}
}


function txClickEvent(eventId) {

	var eventIdx = findEventById(eventId);

	// console.log("Event " + eventId + " has index " + eventIdx);

	if (eventIdx == undefined || eventIdx < 0) {
		return;
	}

	// console.log("txViews / playPEEvents for Index " + eventIdx);

	// Send views
	txViews(eventIdx);

	// Send events
	setTimeout(function() {
		playPEEvents(eventIdx);
	}, 250);

	// Play
	setTimeout(function() {

		var pevstate = eventliststates[eventIdx];
		// console.log("pevstate");
		// console.log(pevstate);

		for (var pei = 0; pei < pevstate.peviews.length; pei++) {
			var peview = pevstate.peviews[pei];
			var scrname = peview.viewstate.name;
			var layerid = peview.layerid;
			if (layerid != 'none' && peview.actions.length > 0) {
				var scrcommand = {
					view: scrname,
					scrtxmsg: {
						command: 'play',
						info: ''
					}
				};
				var scrjson = JSON.stringify(scrcommand);
				socket.emit('screenmsg', scrjson);
			}
		}
	}, 500);
}


function findEventById(eventId) {
	// console.log("findEventById: looking for event index for ID " + eventId);
	// console.log(eventliststates);
	indexes = $.map(eventliststates, function(obj, idx) {
		// console.log(obj);
		if (obj.id == eventId) {
			return idx;
		}
	});
	return indexes[0];
}


// Generate an ID for this page. This is used for single instance checking.
var myId = "DESIGN" + UniqueId();


/**
 * Show the "one instance only" error element, and hide the page.
 *
 */
function showInstanceError() {
	$("#instanceError").show();
	$("#page").remove();
}


/**
 * Initial set up
 *
 */
function setup() {

	if (USEIO) {

		socket = io(serverurl);

		socket.on('updateEvents', function(respdata) {
			//console.log(respdata);
			ioUpdate(respdata);
		});

		socket.on("instance:syn", function(msg) {
			if (msg && msg.id && msg.id != myId) {
				socket.emit("instance:ack", { id: myId });
			}
		});

		socket.on("instance:ping", function(msg) {
			if (msg && msg.id && msg.id != myId) {
				socket.disconnect();
				showInstanceError();
			}
		});

		if (window.single_instance) {
			// If single_instance mode is enabled, send the check message.
			socket.emit('instance:check', { id: myId });
		}
	}

	coreSetup();
	// Tabs  - thanks Seb Kay http://inspirationalpixels.com/tutorials/creating-tabs-with-html-css-and-jquery
	$('.tabs .tab-links a').on('click', function (e) {
		var currentAttrValue = $(this).attr('href');

		// Show/Hide Tabs
		$('.tabs ' + currentAttrValue).show().siblings().hide();

		// Change/remove current tab to active
		$(this).parent('li').addClass('active').siblings().removeClass('active');

		e.preventDefault();
		screenSetup();
		resizeStages();
	});

	screenSetup();
	var hwratio = project.screenheight / project.screenwidth;
	var vh = sh - 4;
	var vw = sw - 4;
	var vhwratio = vh / vw;
	if (vhwratio > hwratio) {
		var stw = vw;
		var sth = Math.round(vw * hwratio);
	}
	else {
		var sth = vh;
		var stw = Math.round(vh / hwratio);
	}
	$('#designstage').height(sth);
	$('#designstage').width(stw);

	stage = new Konva.Stage({
		container: designstage,
		id: 'stage0',
		name: 'designstage',
		width: stw,
		height: sth
	});

	//	console.log(vh,vw,sth,stw);
	//setup objlist
	objstage = new Konva.Stage({
		container: libpane,
		name: 'objscreen',
		width: libw - 10,
		height: libh - 10
	});
	objlayer = new Konva.Layer({ name: "objlayer" });
	objstage.add(objlayer);
	//librarylist selector
	objlayer.add(libselector);

	loadObjects('all');
	objlayer.draw();

	//setup actionlist
	actstage = new Konva.Stage({
		container: actionpane,
		name: 'actscreen',
		width: actw - 10,
		height: acth - 10
	});
	$('#castaction').prop('checked', castmode);


	//smartmenus
	$(function () {
		$('#treemenu').smartmenus({
			subMenusMinWidth: '80px',
			subMenusMaxWidth: '150px',
			noMouseOver: true
		});
	});


	//jstree
	treecontainer = $('#tree');
	$(function () { treecontainer.jstree(); });
	changeCallback = updateObjStateandTree;

	$('#objecttypeselect').empty();
	$('#objecttypeselect').append(makeObjectListOptions());

	disableDesignButtons();
	$('#multiselectbutton').css("background-color", "#eeaa88");
	togShowall();



	document.addEventListener("fullscreenchange", function () {
		screenSetup();
		resizeStages();
		stageDims();
	}, false);

	document.addEventListener("mozfullscreenchange", function () {
		screenSetup();
		resizeStages();
		stageDims();
	}, false);

	document.addEventListener("webkitfullscreenchange", function () {
		screenSetup();
		resizeStages();
		stageDims();
	}, false);

	screenSetup();
	resizeStages();
	stageDims();

	$('#treespace').resizable({
		// only use the southern handle
		handles: 's',
		// restrict the height range
		minHeight: 50,
		maxHeight: 600,
		// resize handler updates the content panel height
		resize: function (event, ui) {
			var currentHeight = ui.size.height;

			// this accounts for padding in the panels +
			// borders, you could calculate this using jQuery
			var padding = 12;

			// this accounts for some lag in the ui.size value, if you take this away
			// you'll get some instable behaviour
			$(this).height(currentHeight);

			// set the tree panel height
			var containerHeight = $('#leftcolumn').height();
			var menuHeight = $('#treemenu').height();
			$("#propedit").height(containerHeight - menuHeight - currentHeight - padding);
		}
	});

	$('#designspace').resizable({
		// only use the southern handle
		handles: 's',
		// restrict the height range
		minHeight: 50,
		// ghost: true,
		// maxHeight: 650,
		// resize handler updates the content panel height
		start: function(event, ui) {
			stage.clear();
			$("#designstage").css("visibility", "hidden");
		},
		stop: function(event, ui) {
			$("#designstage").css("visibility", "visible");
			var currentHeight = ui.size.height;

			// this accounts for padding in the panels +
			// borders, you could calculate this using jQuery
			var padding = 1;

			// this accounts for some lag in the ui.size value, if you take this away
			// you'll get some instable behaviour
			$(this).height(currentHeight);

			//$('.tab').height(currentHeight-52);

			// set the design panel height
			var containerHeight = $('#rightcolumn').height();
			var menuHeight = $('#menu').height();
			var tabpaneHeight = containerHeight - menuHeight - currentHeight - padding;
			$(".tabs").height(tabpaneHeight);
			$('#libpane').height(tabpaneHeight - 80);
			$('#actionpane').height(tabpaneHeight - 80);
			libh = $('#libpane').height();
			acth = $('#actionpane').height();
			sh = $('#designspace').height();
			stageDims();
			if (stage != null) {
				stage.clear();
				if (layer == null) {
					layer = stage.getLayers()[0];
				}
				layer.draw();
				var id = layer.id();
				treecontainer.jstree('select_node', id);
			}
		}

	});

	$(window).focus(function () {
		if (stage != null) {
			stage.clear();
			if (layer != null) {
				layer.draw();
			}
		}
	});

	if (window.auto_save) {
		var idleCallback = function() {
			if (project && project.id == "project") {
				// Skip "new" and unsaved ones
				return;
			}
			saveProject();
		}
		var idle = new Idle({
			onHidden: idleCallback,
			onAway: idleCallback,
			awayTimeout: 2000
		}).start();
	}


	$(document).on("export_complete", function(e) {

		var data = e.res;

		activateModal('projectExport');

		var $modal = $("[data-modal='projectExport']"),
			$content = $modal.find(".content");

		if ( ! data.success) {
			$content.html("Error: " + data.error);
			return;
		}

		if (data.zip) {
			var $a = $("<a>").attr({ 'href': '/export/' + data.zip.file }).html("<strong>Download " + data.zip.file + "</strong><br><br>");
			$content.html("");
			$a.appendTo($content);
		}

	});


	$(document).on("import_complete", function(e) {

		var data = e.res;

		if ( ! data.success) {
			if (data.error) {
				alert(data.error);
			} else {
				alert('Sorry, there was an error uploading the file.');
			}
			return;
		}

		if (data.success && data.project) {
			activateModal('projectImportComplete');
			var $modal = $("[data-modal='projectImportComplete']");
			$modal.find("[data-ui='projectname']").text(data.project.name);
			$modal.find("[data-ui='openproj']").attr('data-projectid', data.project.id);
		}

	});

	$(document).on('click', '[data-modal="projectImportComplete"] [data-ui="openproj"]', function() {
		var el = $(this),
			projectId = el.attr('data-projectid');
		openProject(projectId);
	});

	new LayerStartButton($('#txscrbutton'));

	// Set layer start state when button is clicked (from LayerStartButton.js)
	$(document).on('ui:set_layer_start', function(evt) {
		if (layer != null) {
			var layerstate = layer.getAttr('state');
			var ststateobjs = getLayerObjects(layer);
			layerstate.startstate = JSON.stringify(ststateobjs);  //only startstates of children
			layer.setAttr('state', layerstate);
			$(document).trigger('object_selected', {
				'source': 'after_update',
				'type': 'layer',
				'layer': layer,
			});
		}
	});

}
