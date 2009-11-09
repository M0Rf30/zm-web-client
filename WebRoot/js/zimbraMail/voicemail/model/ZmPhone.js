/*
 * ***** BEGIN LICENSE BLOCK *****
 * 
 * Zimbra Collaboration Suite Web Client
 * Copyright (C) 2007 Zimbra, Inc.
 * 
 * The contents of this file are subject to the Yahoo! Public License
 * Version 1.0 ("License"); you may not use this file except in
 * compliance with the License.  You may obtain a copy of the License at
 * http://www.zimbra.com/license.
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 * 
 * ***** END LICENSE BLOCK *****
 */

/**
* Creates a phone.
* @constructor
* @class
* This class represents a phone.
*
*/
ZmPhone = function() {
	this.name = null;				// The internal representation of the phone.
	this.used = null;				// Amount of quota used.
	this.limit = null;				// Quota size.
	this.folderTree = null;			// Folders
}

ZmPhone.prototype.toString = 
function() {
	return "ZmPhone";
}

ZmPhone.CHECK_INTERNATIONAL = /^0\d*/;
ZmPhone.CHECK_EXTENSION = /^(1?\d{3})?555\d*/;
ZmPhone.CHECK_911 = /^1?911\d*/;
ZmPhone.CHECK_411 = /^1?411\d*/;
ZmPhone.CHECK_VALID = /^1?[2-9]\d{9}$/;

ZmPhone.calculateDisplay =
function(name) {
	if (!name) {
		return "";
	}
	var offset = 0;
	var doIt = false;
	if (name.length == 10) {
		doIt = true;
	} else if ((name.length == 11) && (name.charAt(0) == '1')) {
		doIt = true;
		offset = 1;
	} else if (name.length == 7) {
		doIt = true;
		offset = -3;
	}
	if (doIt) {
		var array = [];
		if (offset>0) array.push(name.substring(0, offset)+"-");
		if (offset>-3) array.push("(", name.substring(offset, offset + 3), ") ");
		array.push(name.substring(offset + 3, offset + 6), "-",	name.substring(offset + 6, offset + 10));
		return array.join("");
	} else {
// TODO: How to handle other numbers????	
		return name;
	}
};

ZmPhone.calculateName =
function(display) {
	return display.replace(/[^\d]/g, '');
};

ZmPhone.calculateFullName =
function(display) {
	var name = ZmPhone.calculateName(display);
	return (/^1/.exec(name)) ? name : "1" + name;
};

ZmPhone.calculateNonFullName =
function(display) {
	return ZmPhone.calculateName(display).replace(/^1/, "");
};

ZmPhone.isValid =
function(str) {
	var nameLength = ZmPhone.calculateName(str).length;
	return (7 <= nameLength) && (nameLength <= 20) && !/[^0-9()\-\s\+\.]/.exec(str);
};

ZmPhone.prototype.validate =
function(number, errors) {
	if (AjxUtil.isNumber(number))
		number = ""+number;
	if (!AjxUtil.isString(number)) {
		errors.push(ZmMsg.errorPhoneInvalid);
		return false;
	}
	
	number = ZmPhone.calculateName(number);
	
	if (number == this.name) {
		errors.push(ZmMsg.errorPhoneIsOwn);
		return false;
	}
	
	if (ZmPhone.CHECK_INTERNATIONAL.test(number)) {
		errors.push(ZmMsg.errorPhoneIsInternational);
		return false;
	}
	
	if (number.length >= 3) {
		var areacode = (number.length==11)? number.substring(1, 4) : number.substring(0, 3);
		if (areacode == "900" || areacode == "500" || areacode == "700" || areacode == "976") {
			errors.push(ZmMsg.errorPhoneInvalidAreaCode);
			return false;
		}
	}
	
	if (ZmPhone.CHECK_EXTENSION.test(number)) {
		errors.push(ZmMsg.errorPhoneInvalidExtension);
		return false;
	}
	
	if (ZmPhone.CHECK_911.test(number)) {
		errors.push(ZmMsg.errorPhoneIs911);
		return false;
	}
	
	if (ZmPhone.CHECK_411.test(number)) {
		errors.push(ZmMsg.errorPhoneIs411);
		return false;
	}
		
	if (!ZmPhone.CHECK_VALID.test(number)) {
		errors.push(ZmMsg.errorPhoneInvalid);
		return false;
	}
	return true;
}

ZmPhone.prototype.getDisplay =
function() {
	if (!this._display) {
		this._display = ZmPhone.calculateDisplay(this.name);
	}
	return this._display;
};

ZmPhone.prototype.getCallUrl = 
function() {
	return "callto:+1" + this.name;
};

ZmPhone.prototype._loadFromDom = 
function(node) {
	this.name =  node.name;
	this.id = node.name; // March '08: id only used in list view in voice prefs.
	this.hasVoiceMail = node.vm;
	if (node.used && node.used.length) this.used =  node.used[0]._content;
	if (this.limit && this.limit.length) this.limit = node.limit[0]._content;
	this._initializeFeatures();
	var features = node.callfeatures[0].callfeature;
	this._featuresDefined = true;
	if (features) {
		for (var i = 0, count = features.length; i < count; i++) {
			var name = features[i].name;
			var feature = this._features[name];
			if (feature) {
				feature.isSubscribed = true;
				this._featuresDefined = false;
			}
		}
	}
};

/////////////////////////////////////////////////////
// Make a subclass for this stuff?
/////////////////////////////////////////////////////

ZmPhone.prototype.getCallFeatures = 
function(callback, errorCallback) {
	if (this._featuresDefined) {
		if (callback) {
			callback.run(this._features, this);
		}
	} else {
	    var soapDoc = AjxSoapDoc.create("GetVoiceFeaturesRequest", "urn:zimbraVoice");
		appCtxt.getApp(ZmApp.VOICE).setStorePrincipal(soapDoc);
		var node = soapDoc.set("phone");
	    node.setAttribute("name", this.name);
	    for (var i in this._features) {
	    	var feature = this._features[i];
	    	if (feature.isSubscribed && !feature.isVoicemailPref) {
		    	soapDoc.set(feature.name, null, node);
	    	}
	    }
	    var respCallback = new AjxCallback(this, this._handleResponseGetVoiceFeatures, callback);
	    var params = {
	    	soapDoc: soapDoc, 
	    	asyncMode: true,
			callback: respCallback,
			errorCallback: errorCallback
		};
		appCtxt.getAppController().sendRequest(params);
	}
};

ZmPhone.prototype._handleResponseGetVoiceFeatures = 
function(callback, response) {
	var features = response._data.GetVoiceFeaturesResponse.phone[0];
	for(var i in features) {
		if (i == ZmCallFeature.VOICEMAIL_PREFS) {
			var voicemailPrefs = features[i][0].pref;
			this._loadVoicemailPrefs(voicemailPrefs);
		} else {
			var feature = this._features[i];
			if (feature) { //TODO: this check is sposed to be unnecessary.
				feature._loadCallFeature(features[i][0]);
			}
		}
	}
	this._featuresDefined = true;
	if (callback) {
		callback.run(this._features, this);
	}
};

ZmPhone.prototype._loadVoicemailPrefs = 
function(voicemailPrefs) {
	for(var i = 0, count = voicemailPrefs.length; i < count; i++) {
		var obj = voicemailPrefs[i];
		var feature = this._features[obj.name];
		if (feature) {
			feature._loadVoicemailPref(obj);
		}
	}
};

ZmPhone.prototype._initializeFeatures = 
function() {
	this._features = {};
	for(var i = 0, count = ZmCallFeature.CALL_FEATURES.length; i < count; i++) {
		var name = ZmCallFeature.CALL_FEATURES[i];
		this._features[name] = new ZmCallFeature(name, false, false);
	}
	for(var i = 0, count = ZmCallFeature.VOICE_FEATURES.length; i < count; i++) {
		var name = ZmCallFeature.VOICE_FEATURES[i];
		this._features[name] = new ZmCallFeature(name, true, this.hasVoiceMail);
	}
};

ZmPhone.prototype.modifyCallFeatures = 
function(batchCommand, newFeatures, callback) {
    var soapDoc = AjxSoapDoc.create("ModifyVoiceFeaturesRequest", "urn:zimbraVoice");
	appCtxt.getApp(ZmApp.VOICE).setStorePrincipal(soapDoc);
    var node = soapDoc.set("phone");
    node.setAttribute("name", this.name);
	var voicemailPrefsNode = null;
	for (var i = 0, count = newFeatures.length; i < count; i++) {
		if (newFeatures[i].isVoicemailPref) {
			if (!voicemailPrefsNode) {
				voicemailPrefsNode = soapDoc.set(ZmCallFeature.VOICEMAIL_PREFS, null, node);
			}
			newFeatures[i].addVoicemailChangeNode(soapDoc, voicemailPrefsNode);
		} else {
			newFeatures[i].addChangeNode(soapDoc, node);
		}
	}
	var respCallback = new AjxCallback(this, this._handleResponseModifyVoiceFeatures, [newFeatures, callback]);
	batchCommand.addNewRequestParams(soapDoc, respCallback);
};

ZmPhone.prototype._handleResponseModifyVoiceFeatures = 
function(newFeatures, callback) {
	for(var i = 0, count = newFeatures.length; i < count; i++) {
		var feature = this._features[newFeatures[i].name];
		feature.assignFrom(newFeatures[i]);
	}
	if (callback) {
		callback.run();
	}
};

