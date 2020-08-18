"use strict";
/*

Copyright 2010-2018 Scott Fortmann-Roe. All rights reserved.

This file may distributed and/or modified under the
terms of the Insight Maker Public License (https://InsightMaker.com/impl).

*/

var unfoldingManager = {
	unfolding: false
};

var unfoldingReady = false;
var doneUnfolding = false;

function beginUnfolding() {
	if (is_editor && (!is_embed)) {
		showNotification(getText("Edits to the model will not be saved while you are viewing the story."), "notice", true);
	}

	unfoldingManager.unfolding = true;
	unfoldingManager.init = getGraphXml(graph);
	initUnfolding();
	unfoldingReady = true;
}

function restartUnfolding(config) {
	//Instrument
	loadStoredUnfolding();
	if (config) {
		saveUnfoldingStatus(config);
		unfoldingManager.init = getGraphXml(graph);
	}
	initUnfolding();
}

function saveUnfoldingStatus(config) {

	var oldUnfolding = unfoldingManager.unfolding;
	unfoldingManager.unfolding = false;

	graph.getModel().beginUpdate();

	var edit = new mxCellAttributeChange(getSetting(), "unfolding", config.steps);
	graph.getModel().execute(edit);
	edit = new mxCellAttributeChange(getSetting(), "unfoldingStatus", config.enabled);
	graph.getModel().execute(edit);
	edit = new mxCellAttributeChange(getSetting(), "unfoldingAuto", config.auto);
	graph.getModel().execute(edit);

	graph.getModel().endUpdate();


	unfoldingManager.unfolding = oldUnfolding;
}

function finishUnfolding() {
	loadStoredUnfolding();
	unfoldingManager.unfolding = false;
	selectionChanged();
}

function loadStoredUnfolding() {
	if (unfoldingManager.init) {
		importMXGraph(unfoldingManager.init);
		if ((!is_editor) && (is_embed) && (is_zoom == 1)) {
			graph.getView().setScale(0.25);
			graph.fit();
			graph.fit();
		}
	}
}

function initUnfolding() {
	if (getSetting().getAttribute("unfolding")) {
		unfoldingManager.steps = JSON.parse(getSetting().getAttribute("unfolding"));
		unfoldingManager.step = 0;
		Ext.getCmp("messageUnfoldBut").update("");
		Ext.getCmp("nextUnfoldBut").setDisabled(false);
		doUnfoldStep();
	} else {
		unfoldingManager.steps = {
			children: []
		};
		unfoldingReady = true;
		doneUnfolding = true;
		window.lastStepTypes = [];
	}
}

function doUnfoldStep() {
	unfoldingReady = false;
	if (unfoldingManager.steps.children.length > unfoldingManager.step) {
		var action = unfoldingManager.steps.children[unfoldingManager.step];
		window.lastStepTypes = [];
		executeUnfoldAction(action);
		unfoldingManager.step++;
	} else {
		doneUnfolding = true;
	}
	if (unfoldingManager.steps.children.length <= unfoldingManager.step) {
		Ext.getCmp("nextUnfoldBut").setDisabled(true);
	}
	unfoldingReady = true;
	//setTimeout(function(){unfoldingReady = true;}, 1000);
}

function executeUnfoldAction(action) {
	if (action.type == "group") {
		for (var i = 0; i < action.children.length; i++) {
			executeUnfoldAction(action.children[i]);
		}
	} else if (action.type == "note" || action.type == "noteMessage") {
		lastStepTypes.push("note")

		if (action.type == "note") {
			var msg = action.data;
		} else {
			var data = JSON.parse(action.data);
			var items = findID(data.ids).filter(function(x) {
				return x !== null
			});
			//setSelected(items);
			msg = getNote(items).join("<br/>");
		}

		if (Ext.getCmp("messageUnfoldBut").getEl().down(".message")) {
			Ext.getCmp("messageUnfoldBut").getEl().down(".message").fadeOut({
				duration: 300
			});
			setTimeout(function() {
				Ext.getCmp("messageUnfoldBut").update("<div class='message'>" + msg + "</div>");
			}, 400)
		} else {
			Ext.getCmp("messageUnfoldBut").update("<div class='message'>" + msg + "</div>")
		}

	} else if (action.type == "visibility") {
		lastStepTypes.push("diagram");
		var data = JSON.parse(action.data)
		graph.getModel().beginUpdate();
		var items = findID(data.ids).filter(function(x) {
			return x !== null
		});
		if (items.length == []) {
			items = findAll();
		}
		var ghosts = [];
		var nonGhosts = [];
		items.forEach(function(cell) {
			if (cell.value.nodeName == "Ghost") {
				ghosts.push(cell)
			} else {
				nonGhosts.push(cell);
			}
		})
		setOpacity(nonGhosts, data.opacity);
		setOpacity(ghosts, data.opacity * .3);
		graph.getModel().endUpdate();
	} else if (action.type == "action") {
		//lastStepTypes.push("diagram")
		runAction(action.data);
	} else if (action.type == "simulate") {
		lastStepTypes.push("simulation");
		runModel({
			silent: false,
			selectedDisplay: findID(JSON.parse(action.data).display),
			rate: window.storyConverter ? -1 : undefined
		});
	} else if (action.type == "folder") {
		lastStepTypes.push("diagram");
		var data = JSON.parse(action.data)
		var folders = findID(data.ids).filter(function(x) {
			return x !== null
		});
		if (data.mode == "expand") {
			expandFolder(folders);
		} else {
			collapseFolder(folders);
		}
	} else if (action.type == "valueChange") {
		var data = JSON.parse(action.data);
		setValue(findID(data.ids), data.newValue);
	} else {
		alert("Unknown action!");
		console.log(action);
	}
}

var handleUnfoldToolbar = function(fromWin) {
	var unfoldEnabled = getSetting().getAttribute("unfoldingStatus") == "on";
	var toolbar = Ext.getCmp("unfoldToolbar");

	if ((!fromWin) || ((unfoldEnabled && toolbar.isHidden()) || ((!unfoldEnabled) && (!toolbar.isHidden())))) {
		if (unfoldEnabled) {
			toolbar.show();
		} else {
			toolbar.hide();
		}

		var should_unfold = false;
		var auto = getSetting().getAttribute("unfoldingAuto");
		if (isUndefined(auto)) {
			auto = "non-editors";
		}
		if ((!fromWin) && auto != "never") {
			if (auto == "always") {
				should_unfold = true;
			} else if (is_embed && auto != "editors") {
				should_unfold = true;
			} else if (auto == "editors" && is_editor) {
				should_unfold = true;
			} else if (auto == "non-editors" && (!is_editor)) {
				should_unfold = true;
			}
		}

		revealUnfoldButtons(should_unfold);
		if (should_unfold && unfoldEnabled) {
			beginUnfolding();
		}
	}
}

var revealUnfoldButtons = function(showUnfold) {
	if (showUnfold) {
		Ext.getCmp('unfoldUnfoldBut').hide();
		Ext.getCmp('editUnfoldBut').hide();
		Ext.getCmp('reloadUnfoldBut').show();
		if (!is_ebook) {
			Ext.getCmp('exitUnfoldBut').show();
		}

		Ext.getCmp('messageUnfoldBut').show();
		Ext.getCmp('nextUnfoldBut').show();
	} else {
		Ext.getCmp('unfoldUnfoldBut').show();
		if (is_editor && !is_ebook) {
			Ext.getCmp('editUnfoldBut').show();
		}
		Ext.getCmp('reloadUnfoldBut').hide();
		Ext.getCmp('exitUnfoldBut').hide();
		Ext.getCmp('messageUnfoldBut').hide();
		Ext.getCmp('nextUnfoldBut').hide();
	}
}


	function showUnfoldingWin() {
		var preventEdits = false;
		var mySetting = getSetting();

		function saveVisibility() {
			if (Ext.getCmp("opacitySlider")) {
				var opacity = Ext.getCmp("opacitySlider").getValue();
				var ids = Ext.getCmp("unfoldingPrimitives").getValue();
				selectedNode.set("data", JSON.stringify({
					opacity: opacity,
					ids: ids
				}));
			}
		}

		function loadVisibility() {
			var data = JSON.parse(selectedNode.get("data"));
			Ext.getCmp("opacitySlider").setValue(data.opacity);
			Ext.getCmp("unfoldingPrimitives").setValue(data.ids);
		}

		function saveNoteMessage() {
			if (Ext.getCmp("unfoldingPrimitivesNotes")) {
				var ids = Ext.getCmp("unfoldingPrimitivesNotes").getValue();
				selectedNode.set("data", JSON.stringify({
					ids: ids
				}));
			}
		}

		function loadNoteMessage() {
			var data = JSON.parse(selectedNode.get("data"));
			Ext.getCmp("unfoldingPrimitivesNotes").setValue(data.ids);
		}

		function saveChangeValue() {
			if (Ext.getCmp("unfoldingValuePrimitives")) {
				var newValue = Ext.getCmp("unfoldingNewValue").getValue();
				var ids = Ext.getCmp("unfoldingValuePrimitives").getValue();
				selectedNode.set("data", JSON.stringify({
					newValue: newValue,
					ids: ids
				}));
			}
		}

		function loadChangeValue() {
			var data = JSON.parse(selectedNode.get("data"));
			Ext.getCmp("unfoldingValuePrimitives").setValue(data.ids);
			Ext.getCmp("unfoldingNewValue").setValue(data.newValue);
		}

		function saveFolder() {
			if (Ext.getCmp("modeCombo")) {
				var mode = Ext.getCmp("modeCombo").getValue();
				var ids = Ext.getCmp("unfoldingFolders").getValue();
				selectedNode.set("data", JSON.stringify({
					mode: mode,
					ids: ids
				}));
			}
		}

		function saveSimulate() {
			if (Ext.getCmp("simulateSelectedDisplayCombo")) {
				selectedNode.set("data", JSON.stringify({
					display: Ext.getCmp("simulateSelectedDisplayCombo").getValue()
				}));
			}
		}
		

		function loadFolder() {
			var data = JSON.parse(selectedNode.get("data"));
			Ext.getCmp("modeCombo").setValue(data.mode);
			Ext.getCmp("unfoldingFolders").setValue(data.ids);
		}

		function storeToJson(includeFlag) {
			var getJson = function(t) {
				// Should deep copy so we don't affect the tree
				var j = t.data;
				var json = {
					text: j.text,
					data: j.data,
					type: j.type,
					leaf: j.leaf,
					expanded: j.expanded
				}
				if (includeFlag) {
					json.flag = j.flag;
				}

				json.children = [];
				for (var i = 0; i < t.childNodes.length; i++) {
					json.children.push(getJson(t.childNodes[i]))
				}
				return json;
			}
			return getJson(treeStore.getRootNode());
		}

		function addNewNode(obj) {
			var parent = tree.getRootNode();
			var index = parent.childNodes.length + 1;
			if (selectedNode) {
				if (selectedNode.get("type") == "group" && selectedNode.isExpanded()) {
					parent = selectedNode;
					index = 0;
				} else {
					parent = selectedNode.parentNode;
					index = parent.indexOf(selectedNode) + 1;
				}
			}
			var node = parent.insertChild(index, obj);
			tree.getSelectionModel().select(node);
		}

		var selectedNode;
		var treeStore = new Ext.data.TreeStore({
			fields: [{
				name: 'text',
				type: 'string'
			}, {
				name: 'type',
				type: 'string'
			}, {
				name: 'data',
				type: 'string'
			}, {
				name: 'flag',
				type: 'string'
			}],
			proxy: {
				type: 'memory'
			}
		});
		if (mySetting.getAttribute("unfolding")) {
			treeStore.setRootNode(JSON.parse(mySetting.getAttribute("unfolding")));
		} else {
			treeStore.setRootNode({
				text: 'Root Node',
				type: 'root',
				id: 'src',
				expanded: true
			});
		}
		
		var handleSelection = function(){
			if(selectedNode){
				var type = selectedNode.get("type");
				selectedNode.set("flag", "selected");

				if (type == "visibility") {
					configs.getLayout().setActiveItem(1);
					loadVisibility();
				} else if (type == "noteMessage") {
					configs.getLayout().setActiveItem(7);
					loadNoteMessage();
				} else if (type == "note") {
					Ext.getCmp("actionNote").setValue(selectedNode.get("data"));
					configs.getLayout().setActiveItem(2);
				} else if (type == "simulate") {
					Ext.getCmp("simulateSelectedDisplayCombo").setValue(JSON.parse(selectedNode.get("data")).display);
					configs.getLayout().setActiveItem(3);
				} else if (type == "action") {
					Ext.getCmp("actionCode").setValue(selectedNode.get("data"));
					configs.getLayout().setActiveItem(4);
				} else if (type == "group") {
					Ext.getCmp("selectedDisplayCombo, selectedNode.get")
					Ext.getCmp("groupName").setValue(selectedNode.get("text"));
					configs.getLayout().setActiveItem(5);
				} else if (type == "folder") {
					configs.getLayout().setActiveItem(6);
					loadFolder();
				} else if (type == "valueChange") {
					configs.getLayout().setActiveItem(8);
					loadChangeValue();
				}
			}
			
		};
		var tree = Ext.create('Ext.tree.Panel', {
			title: getText('Story Steps'),
			disabled: !(mySetting.getAttribute("unfoldingStatus") == "on"),
			useArrows: true,
			width: 280,
			rootVisible: false,
			id: "stepsTree",
			store: treeStore,
			viewConfig: {
				plugins: {
					ptype: 'treeviewdragdrop',
					containerScroll: true
				}
			},
			listeners: {
				select: {
					fn: function(t, record, index, eOpts) {
						//console.log("select");
						preventEdits = true;
						if (selectedNode) {
							selectedNode.set("flag", "")
						}
						selectedNode = record;
						
						handleSelection();

						preventEdits = false;
					}
				}
			},
			bbar: [{
				glyph: 0xf056,
				text: getText('Remove'),
				scope: this,
				iconCls: 'red-icon',
				handler: function() {
					var json = storeToJson(true);

					function removeSelected(root) {
						for (var i = 0; i < root.children.length; i++) {
							if (root.children[i].flag == "selected") {
								root.children.splice(i, 1);
								i--;
							} else {
								removeSelected(root.children[i]);
							}
						}
					}

					removeSelected(json);
					treeStore.setRootNode(json);
					configs.getLayout().setActiveItem(0);

					selectedNode = null;
				}
			}, "->", {
				glyph: 0xf055,
				iconCls: 'green-icon',
				text: getText('Add Step'),
				scope: this,
				menu: {
					xtype: "menu",
					items: [{
							text: getText('Change Visibility'),
							handler: function() {
								addNewNode({
									text: getText("Visibility Change"),
									data: "{\"opacity\": 100, \"ids\": []}",
									type: "visibility",
									leaf: true
								});
							}
						}, {
							text: getText('Toggle Folders'),
							handler: function() {
								addNewNode({
									text: getText("Toggle Folders"),
									data: "{\"mode\": \"expand\", \"ids\": []}",
									type: "folder",
									leaf: true
								});
							}
						},
						'-', {
							text: getText('Show Message'),
							handler: function() {
								addNewNode({
									text: getText("Show Message"),
									data: getText("Enter your message..."),
									type: "note",
									leaf: true
								});
							}
						}, {
							text: getText('Show Note as Message'),
							handler: function() {
								addNewNode({
									text: getText("Note Message"),
									data: "{\"ids\": []}",
									type: "noteMessage",
									leaf: true
								});
							}
						},
						'-', {
							text: getText('Change Value'),
							handler: function() {
								addNewNode({
									text: getText("Value Change"),
									data: "{\"newValue\": \"100\", \"ids\": []}",
									type: "valueChange",
									leaf: true
								});
							}
						},
						'-', {
							text: getText('Run Simulation'),
							handler: function() {
								addNewNode({
									text: getText("Run Simulation"),
									data: "{}",
									type: "simulate",
									leaf: true
								});
							}
						},
						'-', {
							text: getText('Run Action'),
							handler: function() {
								addNewNode({
									text: getText("Run Action"),
									data: "",
									type: "action",
									leaf: true
								});
							}
						},
						'-', {
							text: getText('Group Steps'),
							handler: function() {
								addNewNode({
									text: getText("New Group"),
									type: "group",
									leaf: false,
									expanded: true
								});
							}
						}
					]
				}
			}]

		});



		var storeData = [];
		var prims = findAll();
		for (var i = 0; i < prims.length; i++) {
			var n = getName(prims[i]);
			storeData.push({
				pid: getID(prims[i]),
				pname: isDefined(n) ? n : "--"
			});
		}

		//console.log(storeData)
		storeData.sort(function(a, b) {
			return a.pname.localeCompare(b.pname);
		});

		var primitiveConfigStore = new Ext.data.JsonStore({
			fields: [{
				name: 'pid',
				type: 'string'
			}, {
				name: 'pname',
				type: 'string'
			}],
			data: storeData
		});

		storeData = [];
		prims = findType("Folder");
		for (var i = 0; i < prims.length; i++) {
			var n = getName(prims[i]);
			storeData.push({
				pid: getID(prims[i]),
				pname: isDefined(n) ? n : "--"
			});
		}

		//console.log(storeData)
		storeData.sort(function(a, b) {
			return a.pname.localeCompare(b.pname);
		});

		var folderConfigStore = new Ext.data.JsonStore({
			fields: [{
				name: 'pid',
				type: 'string'
			}, {
				name: 'pname',
				type: 'string'
			}],
			data: storeData
		});


		storeData = [];
		prims = findType(["Stock", "Flow", "Variable"]);
		for (var i = 0; i < prims.length; i++) {
			var n = getName(prims[i]);
			storeData.push({
				pid: getID(prims[i]),
				pname: isDefined(n) ? n : "--"
			});
		}

		//console.log(storeData)
		storeData.sort(function(a, b) {
			return a.pname.localeCompare(b.pname);
		});

		var valuedConfigStore = new Ext.data.JsonStore({
			fields: [{
				name: 'pid',
				type: 'string'
			}, {
				name: 'pname',
				type: 'string'
			}],
			data: storeData
		});



		var configs = Ext.create('Ext.container.Container', {
			flex: 1,
			layout: 'card',
			items: [{
					xtype: "panel",
					padding: 8,
					bodyStyle: 'background:none',
					border: false,
					html: '<p style="color:grey; text-align:center; line-height:1.5em">Use the Story Designer to construct a step-by-step walkthrough of your model. You can reveal your model piece-by-piece, display messages, and run simulations.<br/></br>Once your story is done, consider sharing it with others.</p>'
				}, {
					xtype: "container",
					padding: 8,
					bodyStyle: 'background:none',
					border: false,
					autoScroll: true,
					layout: {
						type: 'vbox',
						align: 'stretch'
					},
					items: [{
							xtype: "displayfield",
							value: getText("Opacity") + ":"
						}, {
							xtype: "slider",
							id: "opacitySlider",
							value: 100,
							increment: 1,
							minValue: 0,
							animate: false,
							listeners: {
								change: saveVisibility
							}
						}, {
							xtype: "displayfield",
							value: getText("Primitives (leave blank to apply to all)") + ":"
						},
						Ext.create('Ext.form.field.Tag', {
							hideLabel: true,
							name: 'unfoldingPrimitives',
							id: 'unfoldingPrimitives',
							filterPickList: true,
							displayField: 'pname',
							valueField: 'pid',
							queryMode: 'local',
							store: primitiveConfigStore,
							emptyText: getText("Data"),
							listeners: {
								change: saveVisibility
							},
							bbar: []
						}),

						{
							xtype: "container",
							bodyStyle: 'background:none',
							border: false,
							autoScroll: true,
							layout: {
								type: 'hbox',
								align: 'stretch'
							},
							items: [{
									xtype: "button",
									glyph: 0xf056,
									text: getText('Clear'),
									handler: function() {
										Ext.getCmp("unfoldingPrimitives").setValue([]);
									}
								}, {
									xtype: 'box',
									flex: 1
								}, {
									glyph: 0xf055,
									xtype: "button",
									text: getText('Add from Diagram'),
									tooltip: 'Add the selected primitives in the diagram.',
									handler: function() {
										Ext.getCmp("unfoldingPrimitives").setValue(Ext.Array.unique(Ext.getCmp("unfoldingPrimitives").getValue().concat(getSelected().map(function(x) {
											return getID(x);
										}))))
									}
								}

							]
						}


					]
				}, {
					xtype: "container",
					padding: 8,
					bodyStyle: 'background:none',
					border: false,
					layout: {
						type: 'vbox',
						align: 'stretch'
					},
					items: [{
						xtype: 'htmleditor',
						enableColors: false,
						enableSourceEdit: true,
						enableFont: false,
						enableLists: true,
						enableFontSize: false,
						id: "actionNote",
						hideLabel: true,
						flex: 1,
						listeners: {
							change: function(t, newvalue, oldvalue) {
								if (!preventEdits) {
									//console.log("change")
									//console.log(newvalue);
									//console.log(oldvalue)
									selectedNode.set("data", newvalue);
								}

							}
						}
					}]
				}, {
					xtype: "container",
					padding: 8,
					bodyStyle: 'background:none',
					border: false,
					layout: {
						type: 'vbox',
						align: 'stretch'
					},
					items: [{
							xtype: "displayfield",
							value: getText("Initially Selected Display") + ":"
						}, {
							xtype: "combo",
							id: "simulateSelectedDisplayCombo",
							hideLabel: true,
							store: findType("Display").map(function(x) {
								return [x.id, getName(x)]
							}),
							forceSelection: true,
							listeners: {
								select: saveSimulate
							}

						}

					]
				}, {
					xtype: "container",
					padding: 8,
					bodyStyle: 'background:none',
					border: false,
					layout: {
						type: 'vbox',
						align: 'stretch'
					},
					items: [{
							xtype: "displayfield",
							value: getText("JavaScript Action (<a href='//insightmaker.com/sites/default/files/API/files/API-js.html' target='_blank'>API</a>)") + ":"
						}, {
							xtype: 'aceeditor',
							mode: "javascript",
							id: "actionCode",
							flex: 1,
							value: " ",

							listeners: {
								/*blur: function(t){
									var z = t.getEl().down("textarea");
									z.dom.blur();
								},*/
								change: function(t, newvalue, oldvalue) {
									selectedNode.set("data", newvalue);
								}
							}
						}

					]
				}, {
					xtype: "container",
					padding: 8,
					bodyStyle: 'background:none',
					border: false,
					plain: true,
					items: [{
						xtype: 'textfield',
						id: "groupName",
						fieldLabel: getText('Name'),
						labelWidth: 60,
						allowBlank: false,
						listeners: {
							change: function(t, newvalue, oldvalue) {
								selectedNode.set("text", newvalue);
							}
						}
					}]
				}, {
					xtype: "container",
					padding: 8,
					bodyStyle: 'background:none',
					border: false,
					autoScroll: true,
					layout: {
						type: 'vbox',
						align: 'stretch'
					},
					items: [{
							xtype: "displayfield",
							value: getText("Action") + ":"
						}, {
							xtype: "combo",
							id: "modeCombo",
							hideLabel: true,
							store: [
								["expand", getText("Expand")],
								["collapse", getText("Collapse")]
							],
							forceSelection: true,
							listeners: {
								select: saveFolder
							}

						}, {
							xtype: "displayfield",
							value: getText("Folders") + ":"
						},
						Ext.create('Ext.form.field.Tag', {
							hideLabel: true,
							name: 'unfoldingFolders',
							filterPickList: true,
							id: 'unfoldingFolders',
							displayField: 'pname',
							valueField: 'pid',
							queryMode: 'local',
							store: folderConfigStore,
							emptyText: getText("Folders"),
							listeners: {
								change: saveFolder
							}
						})


					]
				},


				{
					xtype: "container",
					padding: 8,
					bodyStyle: 'background:none',
					border: false,
					autoScroll: true,
					layout: {
						type: 'vbox',
						align: 'stretch'
					},
					items: [{
							xtype: "displayfield",
							value: getText("Primitives whose notes will be shown") + ":"
						},
						Ext.create('Ext.form.field.Tag', {
							hideLabel: true,
							name: 'unfoldingPrimitivesNotes',
							id: 'unfoldingPrimitivesNotes',
							displayField: 'pname',
							filterPickList: true,
							valueField: 'pid',
							queryMode: 'local',
							store: primitiveConfigStore,
							emptyText: getText("Data"),
							listeners: {
								change: saveNoteMessage
							}
						}), 
						

						{
							xtype: "container",
							bodyStyle: 'background:none',
							border: false,
							autoScroll: true,
							layout: {
								type: 'hbox',
								align: 'stretch'
							},
							items: [{
									xtype: "button",
									glyph: 0xf056,
									text: getText('Clear'),
									handler: function() {
										Ext.getCmp("unfoldingPrimitivesNotes").setValue([]);
									}
								}, {
									xtype: 'box',
									flex: 1
								}, {
									glyph: 0xf055,
									xtype: "button",
									text: getText('Add from Diagram'),
									tooltip: 'Add the selected primitives in the diagram.',
									handler: function() {
										Ext.getCmp("unfoldingPrimitivesNotes").setValue(Ext.Array.unique(Ext.getCmp("unfoldingPrimitivesNotes").getValue().concat(getSelected().map(function(x) {
											return getID(x);
										}))))
									}
								}

							]
						}
						
					]
				},

				{
					xtype: "container",
					padding: 8,
					bodyStyle: 'background:none',
					border: false,
					layout: {
						type: 'vbox',
						align: 'stretch'
					},
					items: [{
							xtype: "displayfield",
							value: getText("New Value") + ":"
						}, {
							xtype: "textfield",
							id: "unfoldingNewValue",
							hideLabel: true,
							listeners: {
								change: saveChangeValue
							}
						}, 
						{
							xtype: "displayfield",
							value: getText("Primitives whose values will be changed") + ":",
							style: {
								'margin-top': '20px'
							}
						},
						
						Ext.create('Ext.form.field.Tag', {
							hideLabel: true,
							name: 'unfoldingValuePrimitives',
							filterPickList: true,
							id: 'unfoldingValuePrimitives',
							displayField: 'pname',
							valueField: 'pid',
							queryMode: 'local',
							store: valuedConfigStore,
							emptyText: getText("Primitives"),
							listeners: {
								change: saveChangeValue
							}
						})
						

					]
				}
			]
		});

		var p = {
			xtype: "container",
			frame: true,
			layout: {
				type: 'vbox',
				align: 'stretch'
			},
			items: [{

					padding: 8,
					xtype: "container",
					flex: 1,
					layout: {
						type: 'hbox',
						align: 'stretch'
					},
					items: [tree, configs]

				}

			]
		};

		var win = new Ext.Window({
			title: getText('Story Designer'),
			layout: 'fit',
			tools: [{
				type: 'help',
				tooltip: getText('Get Help'),
				callback: function(panel, tool, event) {
					showURL("/storytelling")
				}
			}],
			closeAction: 'destroy',
			border: false,
			modal: false,
			resizable: true,
			maximizable: true,
			stateful: is_editor && (!is_embed),
			stateId: "story_window",
			shadow: true,
			id: "unfold-window",
			buttonAlign: 'right',
			width: Math.min(Ext.getBody().getViewSize().width, 600),
			height: Math.min(Ext.getBody().getViewSize().height, 510),
			items: [p],

			tbar: [{
				xtype: "checkbox",
				id: "enabledChk",
				hideLabel: true,
				boxLabel: getText("Enabled"),
				checked: mySetting.getAttribute("unfoldingStatus") == "on",
				listeners: {
					change: function(combo, newValue, oldValue) {
						if (newValue) {
							Ext.getCmp("stepsTree").setDisabled(false);
							handleSelection();
						} else {
							Ext.getCmp("stepsTree").setDisabled(true);
							configs.getLayout().setActiveItem(0);
						}
					}
				}
			}, '->', {
				xtype: "combo",
				id: "autoCombo",
				fieldLabel: getText("Automatically start story") + ":",
				labelWidth: 180,
				store: [
					["never", getText("Never")],
					["editors", getText("For Editors")],
					["non-editors", getText("For Non-Editors")],
					["always", getText("Always")]
				],
				forceSelection: true,
				value: mySetting.getAttribute("unfoldingAuto") || "non-editors",
				listeners: {
					select: function(combo, record) {

					}
				}
			}],
			buttons: [
				'->', {
					scale: "large",
					glyph: 0xf05c,
					text: getText('Cancel'),
					handler: function() {
						win.close();
					}
				}, {
					scale: "large",
					glyph: 0xf00c,
					text: getText('Apply'),
					handler: function() {
						var config = {
							steps: JSON.stringify(storeToJson()),
							enabled: Ext.getCmp("enabledChk").getValue() ? "on" : "off",
							auto: Ext.getCmp("autoCombo").getValue()
						}

						if (unfoldingManager.unfolding) {
							restartUnfolding(config);
						} else {
							saveUnfoldingStatus(config);
						}
						handleUnfoldToolbar(true);


						win.close();


					}
				}
			]

		});

		win.show();

	}

	function configureArticle() {
		if (has_article) {
			Ext.getCmp("articleText").update("<a href='https://InsightMaker.com/article/" + drupal_node_ID + "/"+getURLTitle()+"' target='_blank'>https://InsightMaker.com/article/" + drupal_node_ID + "/"+getURLTitle()+"</a>");
			Ext.getCmp("articlePublish").hide();
			Ext.getCmp("articleRefresh").show();
			Ext.getCmp("articleDelete").show();
		} else {

			Ext.getCmp("articleText").update("Story article has not been published");
			Ext.getCmp("articlePublish").show();
			Ext.getCmp("articleRefresh").hide();
			Ext.getCmp("articleDelete").hide();
		}
	}


	function deleteArticle() {
		var request = $.ajax({
			type: "GET",
			url: "/builder/StoryConverter.php",
			data: {
				nid: drupal_node_ID,
				"delete": "1"
			}
		});


		has_article = false;
		saveModel();

		configureArticle();
	}


	function blockUnfold(fn){
		return function(){
			if(unfoldingManager.unfolding){
				mxUtils.alert("You cannot use this function while in Storytelling mode.", "notice", true);
			}else{
				fn();
			}
		};
	}