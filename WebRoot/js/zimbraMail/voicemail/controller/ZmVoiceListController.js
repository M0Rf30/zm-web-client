/*
 * ***** BEGIN LICENSE BLOCK *****
 * Version: ZPL 1.2
 *
 * The contents of this file are subject to the Zimbra Public License
 * Version 1.2 ("License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.zimbra.com/license
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See
 * the License for the specific language governing rights and limitations
 * under the License.
 *
 * The Original Code is: Zimbra Collaboration Suite Web Client
 *
 * The Initial Developer of the Original Code is Zimbra, Inc.
 * Portions created by Zimbra are Copyright (C) 2006 Zimbra, Inc.
 * All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK *****
 */

function ZmVoiceListController(appCtxt, container, app) {
	if (arguments.length == 0) return;
	ZmListController.call(this, appCtxt, container, app);

	this._folder = null;
}
ZmVoiceListController.prototype = new ZmListController;
ZmVoiceListController.prototype.constructor = ZmVoiceListController;

ZmVoiceListController.prototype.toString =
function() {
	return "ZmVoiceListController";
};

/**
* Displays the given search results.
*
* @param search		search results (which should contain a list of conversations)
* @param folder		The folder being shown
*/
ZmVoiceListController.prototype.show =
function(searchResult, folder) {
	this._folder = folder;
	ZmListController.prototype.show.call(this, searchResult);
	this._list = searchResult.getResults(folder.getSearchType());
	this._setup(this._currentView);

	var elements = new Object();
	elements[ZmAppViewMgr.C_TOOLBAR_TOP] = this._toolbar[this._currentView];
	elements[ZmAppViewMgr.C_APP_CONTENT] = this._listView[this._currentView];
	this._setView(this._currentView, elements, true);
};

ZmVoiceListController.prototype._setViewContents =
function(viewId) {
	var view = this._listView[viewId];
	view.setCallType(this._folder.callType);	
	view.set(this._list, ZmItem.F_DATE);
};

ZmVoiceListController.prototype._participantOps =
function() {
	return [ZmOperation.CONTACT];
};

ZmVoiceListController.prototype._getParticipantActionMenu =
function() {
	if (!this._participantActionMenu) {
		var menuItems = this._participantOps();
		menuItems.push(ZmOperation.SEP);
		var ops = this._getActionMenuOps();
		if (ops && ops.length) {
			menuItems = menuItems.concat(ops);
		}
    	this._participantActionMenu = new ZmActionMenu({parent:this._shell, menuItems:menuItems});
    	this._addMenuListeners(this._participantActionMenu);
	}
	return this._participantActionMenu;
};


ZmVoiceListController.prototype._getView = 
function() {
	return this._listView[this._currentView];
};

ZmVoiceListController.prototype._getToolbar = 
function() {
	return this._toolbar[this._currentView]
};

ZmVoiceListController.prototype._createNewContact =
function(ev) {
	var voicemail = ev.item;
	var contact = new ZmContact(this._appCtxt);
	contact.initFromPhone(voicemail.caller);
	return contact;
};

ZmVoiceListController.prototype._listActionListener =
function(ev) {
	ZmListController.prototype._listActionListener.call(this, ev);

	var view = ev.dwtObj;
	var isParticipant = ev.field == ZmListView.FIELD_PREFIX[ZmItem.F_PARTICIPANT];
	var actionMenu;
	if (isParticipant) {
	 	actionMenu = this._getParticipantActionMenu();
		var newOp = ev.detail ? ZmOperation.EDIT_CONTACT : ZmOperation.NEW_CONTACT;
		var newText = ev.detail? null : ZmMsg.AB_ADD_CONTACT;
		ZmOperation.setOperation(this._participantActionMenu, ZmOperation.CONTACT, newOp, newText);
		if (this._appCtxt.get(ZmSetting.CONTACTS_ENABLED)) {
			var contacts = AjxDispatcher.run("GetContacts");
			this._actionEv.contact = contacts.getContactByPhone(ev.detail);
			this._setContactText(this._actionEv.contact != null);
		}
	} else  {
	 	actionMenu = this.getActionMenu();
	}
	if (actionMenu) {
		actionMenu.popup(0, ev.docX, ev.docY);
	}
};

