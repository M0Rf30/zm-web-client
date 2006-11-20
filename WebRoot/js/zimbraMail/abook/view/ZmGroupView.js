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

function ZmGroupView(parent, appCtxt, controller) {
	ZmContactView.call(this, parent, appCtxt, controller);
};

ZmGroupView.prototype = new ZmContactView;
ZmGroupView.prototype.constructor = ZmGroupView;


// Consts
ZmGroupListView.ID_ICON  = "i--";
ZmGroupListView.ID_NAME  = "n--";
ZmGroupListView.ID_EMAIL = "e--";


// Public Methods

ZmGroupView.prototype.toString =
function() {
	return "ZmGroupView";
};

ZmGroupView.prototype.set =
function(contact, isDirty) {

	if (!this._htmlInitialized) {
		this._createHtml();
		this._addWidgets();
		this._installKeyHandlers();
	}

	if (this._contact) {
		this._contact.removeChangeListener(this._changeListener);
	}
	contact.addChangeListener(this._changeListener);
	this._contact = contact;

	this._setFields();

	this._isDirty = isDirty;
};

ZmGroupView.prototype.getModifiedAttrs =
function() {
	if (!this.isDirty()) return null;

	var mods = this._attr = {};
	var foundOne = false;

	// get field values
	var groupName = AjxStringUtil.trim(document.getElementById(this._groupNameId).value);
	var groupMembers = this._getGroupMembers();
	var folderId = this._getFolderId();

	// creating new contact (possibly some fields - but not ID - prepopulated)
	if (this._contact.id == null || this._contact.isGal) {
		mods[ZmContact.F_folderId] = folderId
		mods[ZmContact.F_fileAs] = ZmContact.computeCustomFileAs(groupName);
		mods[ZmContact.F_nickname] = groupName;
		mods[ZmContact.F_dlist] = groupMembers;
		mods[ZmContact.F_type] = "group";
		foundOne = true;
	} else {
		// modifying existing contact
		if (this._contact.getFileAs() != groupName) {
			mods[ZmContact.F_fileAs] = ZmContact.computeCustomFileAs(groupName);
			mods[ZmContact.F_nickname] = groupName;
			foundOne = true;
		}

		if (this._contact.getAttr(ZmContact.F_dlist) != groupMembers) {
			mods[ZmContact.F_dlist] = groupMembers;
			foundOne = true;
		}

		if (folderId != this._contact.getFolderId()) {
			mods[ZmContact.F_folderId] = folderId;
			foundOne = true;
		}
	}

	return foundOne ? mods : null;
};

ZmGroupView.prototype.isEmpty =
function(checkEither) {
	var groupName = AjxStringUtil.trim(document.getElementById(this._groupNameId).value);
	var members = AjxStringUtil.trim(this._groupMembers.value);

	return checkEither
		? (groupName == "" || members == "")
		: (groupName == "" && members == "");
};

ZmGroupView.prototype.isValid =
function() {
	if (this.isDirty() && this.isEmpty(true)) {
		throw ZmMsg.errorMissingGroup;
	}
			
	return true;
};

ZmGroupView.prototype.enableInputs =
function(bEnable) {
	document.getElementById(this._groupNameId).disabled = !bEnable;
	this._groupMembers.disabled = !bEnable;
	document.getElementById(this._searchFieldId).disabled = !bEnable;
};

ZmGroupView.prototype.isDirty =
function() {
	return this._isDirty;
};

ZmGroupView.prototype.getTitle =
function() {
	return [ZmMsg.zimbraTitle, ZmMsg.group].join(": ");
};

ZmGroupView.prototype.setSize =
function(width, height) {
	// overloaded since base class calls sizeChildren which we dont care about
	DwtComposite.prototype.setSize.call(this, width, height);
};

ZmGroupView.prototype.setBounds =
function(x, y, width, height) {
	DwtComposite.prototype.setBounds.call(this, x, y, width, height);
	Dwt.setSize(this._groupMembers, Dwt.DEFAULT, height-100);
	this._listview.setSize(Dwt.DEFAULT, height-185);
};

ZmGroupView.prototype.cleanup  =
function() {
	document.getElementById(this._searchFieldId).value = "";
	this._listview.removeAll(true);
	this._addButton.setEnabled(false);
	this._addAllButton.setEnabled(false);
};


// Private methods

ZmGroupView.prototype._setFields =
function() {
	this._setGroupName();
	this._setGroupMembers();
	this._setHeaderColor();
	this._setTitle();
	this._setTags();
};

ZmGroupView.prototype._setTitle =
function(title) {
	var div = document.getElementById(this._titleId);
	var fileAs = title || this._contact.getFileAs();
	div.innerHTML = fileAs || (this._contact.id ? "&nbsp;" : ZmMsg.newGroup);
};

ZmGroupView.prototype._getTagCell =
function() {
	return document.getElementById(this._tagsId);
};

ZmGroupView.prototype._createHtml =
function() {
	this._contactHeaderId = Dwt.getNextId();
	this._contactHeaderRowId = Dwt.getNextId();
	this._titleId = Dwt.getNextId();
	this._tagsId = Dwt.getNextId();
	this._groupNameId = Dwt.getNextId();
	this._groupMembersId = Dwt.getNextId();
	this._searchFieldId = Dwt.getNextId();
	this._listSelectId = Dwt.getNextId();
	this._searchButtonId = Dwt.getNextId();
	this._listViewId = Dwt.getNextId();
	this._addButtonId = Dwt.getNextId();
	this._addAllButtonId = Dwt.getNextId();

	var idx = 0;
	var html = [];

	// Title bar
	html[idx++] = "<table id='";
	html[idx++] = this._contactHeaderId;
	html[idx++] = "' cellspacing=0 cellpadding=0 width=100%><tr class='contactHeaderRow' id='";
	html[idx++] = this._contactHeaderRowId;
	html[idx++] = "'><td width=20><center>";
	html[idx++] = AjxImg.getImageHtml("Group");
	html[idx++] = "</center></td><td><div id='";
	html[idx++] = this._titleId;
	html[idx++] = "' class='contactHeader'></div></td><td align='right' id='";
	html[idx++] = this._tagsId;
	html[idx++] = "'></td></tr></table>";

	// content - left pane
	html[idx++] = "<table border=0 cellpadding=5 cellspacing=5 width=100% height=100%><tr>";
	html[idx++] = "<td width=50% valign=top>";
	html[idx++] = "<table border=0 cellpadding=2 cellspacing=2 width=100%><tr><td colspan=2 nowrap>*&nbsp;";
	html[idx++] = ZmMsg.groupName;
	html[idx++] = ":&nbsp;<input type='text' autocomplete='off' size=25 id='";
	html[idx++] = this._groupNameId;
	html[idx++] = "'></td></tr><tr><td nowrap>*&nbsp;";
	html[idx++] = ZmMsg.groupMembers;
	html[idx++] = ":</td><td class='hintLabel'>";
	html[idx++] = ZmMsg.groupHint;
	html[idx++] = "</td></tr></table>";
	html[idx++] = "<textarea wrap=off class='groupMembers' id='";
	html[idx++] = this._groupMembersId;
	html[idx++] = "'></textarea></td>";

	// content - right pane
	html[idx++] = "<td width=50% valign=top>";
	html[idx++] = "<fieldset><legend class='groupFieldset'>";
	html[idx++] = ZmMsg.addMembers;
	html[idx++] = "</legend><table border=0><tr><td class='editLabel'>";
	html[idx++] = ZmMsg.find;
	html[idx++] = ":</td><td><input type='text' style='width:100%' id='";
	html[idx++] = this._searchFieldId;
	html[idx++] = "'></td></tr><tr><td class='editLabel'>";
	html[idx++] = ZmMsg.searchIn;
	html[idx++] = ":</td><td id='";
	html[idx++] = this._listSelectId;
	html[idx++] = "'></td><td id='";
	html[idx++] = this._searchButtonId;
	html[idx++] = "'></tr></table>";
	html[idx++] = "<div class='groupMembers' id='";
	html[idx++] = this._listViewId;
	html[idx++] = "'></div><table border=0 cellpadding=3 cellspacing=2><tr><td id='";
	html[idx++] = this._addButtonId;
	html[idx++] = "'></td><td id='";
	html[idx++] = this._addAllButtonId;
	html[idx++] = "'></td></tr></table>";
	html[idx++] = "</fieldset></td></tr></table>";

	this.getHtmlElement().innerHTML = html.join("");

	this._htmlInitialized = true;
};

ZmGroupView.prototype._addWidgets =
function() {
	this._groupMembers = document.getElementById(this._groupMembersId);

	// add select menu
	if (this._appCtxt.get(ZmSetting.CONTACTS_ENABLED) &&
		this._appCtxt.get(ZmSetting.GAL_ENABLED))
	{
		this._selectDiv = new DwtSelect(this);
		this._selectDiv.addOption(ZmMsg.contacts, false, ZmContactPicker.SEARCHFOR_CONTACTS);
		if (this._appCtxt.get(ZmSetting.SHARING_ENABLED))
			this._selectDiv.addOption(ZmMsg.searchPersonalAndShared, false, ZmContactPicker.SEARCHFOR_PAS);
		this._selectDiv.addOption(ZmMsg.GAL, true, ZmContactPicker.SEARCHFOR_GAL);
		this._selectDiv.reparentHtmlElement(this._listSelectId);
	}

	// add "Search" button
	this._searchButton = new DwtButton(this);
	this._searchButton.setText(ZmMsg.search);
	this._searchButton.addSelectionListener(new AjxListener(this, this._searchButtonListener));
	this._searchButton.reparentHtmlElement(this._searchButtonId);

	// add list view for search results
	this._listview = new ZmGroupListView(this);
	this._listview.reparentHtmlElement(this._listViewId);
	this._listview.addSelectionListener(new AjxListener(this, this._selectionListener));
	this._listview.setUI(null, true); // renders headers and empty list
	this._listview._initialized = true;

	var addListener = new AjxListener(this, this._addListener);
	// add "Add" button
	this._addButton = new DwtButton(this);
	this._addButton.setText(ZmMsg.add);
	this._addButton.addSelectionListener(addListener);
	this._addButton.reparentHtmlElement(this._addButtonId);
	this._addButton.setEnabled(false);

	// add "Add All" button
	this._addAllButton = new DwtButton(this);
	this._addAllButton.setText(ZmMsg.addAll);
	this._addAllButton.addSelectionListener(addListener);
	this._addAllButton.reparentHtmlElement(this._addAllButtonId);
	this._addAllButton.setEnabled(false);
};

ZmGroupView.prototype._installKeyHandlers =
function() {
	var groupName = document.getElementById(this._groupNameId);
	Dwt.setHandler(groupName, DwtEvent.ONKEYUP, ZmGroupView._onKeyUp);
	Dwt.associateElementWithObject(groupName, this);

	Dwt.setHandler(this._groupMembers, DwtEvent.ONKEYUP, ZmGroupView._onKeyUp);
	Dwt.associateElementWithObject(this._groupMembers, this);

	var searchField = document.getElementById(this._searchFieldId);
	Dwt.setHandler(searchField, DwtEvent.ONKEYPRESS, ZmGroupView._keyPressHdlr);
	Dwt.associateElementWithObject(searchField, this);
};

ZmGroupView.prototype._getTabGroupMembers =
function() {
	var fields = [];
	fields.push(document.getElementById(this._groupNameId));
	fields.push(this._groupMembers);
	fields.push(document.getElementById(this._searchFieldId));
	return fields;
};

ZmGroupView.prototype._getDefaultFocusItem =
function() {
	return document.getElementById(this._groupNameId);
};

ZmGroupView.prototype._getGroupMembers =
function() {
	var addrs = AjxStringUtil.split(this._groupMembers.value, ['\n', ';', ',']);

	// if there are any empty values, remove them
	var i = 0;
	while (true) {
		var email = AjxStringUtil.trim(addrs[i]);
		if (email == "") {
			addrs.splice(i,1);
		} else {
			i++;
		}
		if (i == addrs.length)
			break;
	}

	return addrs.length > 0 ? addrs.join(", ") : null;
};

ZmGroupView.prototype._getFolderId =
function() {
	var id = ZmFolder.ID_CONTACTS;
	if (this._contact.id == null) {
		var clc = this._appCtxt.getApp(ZmZimbraMail.CONTACTS_APP).getContactListController();
		id = clc._folderId;
	} else {
		if (this._contact.addrbook)
			id = this._contact.addrbook.id;
	}
	return id;
};

ZmGroupView.prototype._setGroupMembers =
function() {
	var members = this._contact.getGroupMembers().good.getArray();
	this._groupMembers.value = members.join("\n");
	this._appendNewline();
};

ZmGroupView.prototype._setGroupName =
function() {
	var groupName = document.getElementById(this._groupNameId);
	if (groupName) groupName.value = this._contact.getFileAs() || "";
};


// Listeners

ZmGroupView.prototype._searchButtonListener =
function(ev) {
	this._query = AjxStringUtil.trim(document.getElementById(this._searchFieldId).value);
	if (this._query.length) {
		if (this._appCtxt.get(ZmSetting.GAL_ENABLED)) {
			var searchFor = this._selectDiv.getSelectedOption().getValue();
			this._contactSource = (searchFor == ZmContactPicker.SEARCHFOR_CONTACTS || searchFor == ZmContactPicker.SEARCHFOR_PAS)
				? ZmItem.CONTACT
				: ZmSearchToolBar.FOR_GAL_MI;
			// hack the query if searching for personal and shared contacts
			if (searchFor == ZmContactPicker.SEARCHFOR_PAS) {
				var addrbookList = this._appCtxt.getApp(ZmZimbraMail.CONTACTS_APP).getAddrbookList();
				this._query += " (" + addrbookList.join(" or ") + ")";
			}
		} else {
			this._contactSource = this._appCtxt.get(ZmSetting.CONTACTS_ENABLED) ? ZmItem.CONTACT : ZmSearchToolBar.FOR_GAL_MI;
		}
		this.search(ZmItem.F_PARTICIPANT, true);
	}
};

ZmGroupView.prototype._selectionListener =
function(ev) {
	var selection = this._listview.getSelection();

	if (ev.detail == DwtListView.ITEM_DBL_CLICKED) {
		this._addItems(selection);
	} else {
		this._addButton.setEnabled(selection.length > 0);
	}
};

ZmGroupView.prototype._addListener =
function(ev) {

	var list = ev.dwtObj == this._addButton
		? this._listview.getSelection()
		: this._listview.getList().getArray();

	this._addItems(list);
};

ZmGroupView.prototype._addItems =
function(list) {
	if (list.length == 0) return;

	this._appendNewline();

	// we have to walk the results in case we hit a group which needs to be split
	var items = new Array();
	for (var i = 0; i < list.length; i++) {
		if (list[i].isGroup) {
			var emails = list[i].address.split(ZmEmailAddress.SEPARATOR);
			for (var j = 0; j < emails.length; j++)
				items.push(emails[j]);
		} else {
			items.push(list[i]);
		}
	}
	this._groupMembers.value += (items.join("\n") + "\n");
	this._isDirty = true;
};

// appends newline at the end of textarea if one does not already exist
ZmGroupView.prototype._appendNewline =
function() {
	var members = this._groupMembers.value;
	if (members.length) {
		if (members.charAt(members.length-1) != "\n")
			this._groupMembers.value += "\n";
	}
};

/**
* Performs a contact search (in either personal contacts or in the GAL) and populates
* the source list view with the results.
*
* @param columnItem		[constant]		ID of column to sort by
* @param ascending		[boolean]		if true, sort in ascending order
*/
ZmGroupView.prototype.search =
function(columnItem, ascending) {
	this._searchButton.setEnabled(false);

	var sortBy = ascending ? ZmSearch.NAME_ASC : ZmSearch.NAME_DESC;
	var types = AjxVector.fromArray([ZmItem.CONTACT]);
	var params = {query: this._query, types: types, sortBy: sortBy, offset: 0, limit: ZmContactPicker.SEARCHFOR_MAX, contactSource: this._contactSource};
	var search = new ZmSearch(this._appCtxt, params);
	search.execute({callback: new AjxCallback(this, this._handleResponseSearch),
					errorCallback: new AjxCallback(this, this._handleErrorSearch)});
};

ZmGroupView.prototype._handleResponseSearch =
function(result) {
	var resp = result.getResponse();
	var vec = resp.getResults(ZmItem.CONTACT);

	// Take the contacts and create a list of their email addresses (a contact may have more than one)
	var list = [];
	var a = vec.getArray();
	for (var i = 0; i < a.length; i++) {
		var contact = a[i];
		if (contact.isGroup()) {
			var members = contact.getGroupMembers().good.toString(ZmEmailAddress.SEPARATOR);
			var email = new ZmEmailAddress(members, null, contact.getFileAs(), null, true);
			email.id = Dwt.getNextId();
			email.contactId = contact.id;
			email.icon = "Group";
			list.push(email);
		} else {
			var emails = contact.getEmails();
			for (var j = 0; j < emails.length; j++) {
				var email = new ZmEmailAddress(emails[j], null, contact.getFileAs());
				email.id = Dwt.getNextId();
				email.contactId = contact.id;
				email.icon = contact.isGal ? "GAL" : contact.addrbook.getIcon();
				list.push(email);
			}
		}
	}
	this._listview.setItems(list);
	this._addButton.setEnabled(a.length > 0);
	this._addAllButton.setEnabled(a.length > 0);
	this._searchButton.setEnabled(true);
};

ZmGroupView.prototype._handleErrorSearch =
function() {
	this._searchButton.setEnabled(true);
	return false;
};


// Static methods

ZmGroupView._onKeyUp =
function(ev) {
	ev = DwtUiEvent.getEvent(ev);

	var key = DwtKeyEvent.getCharCode(ev);
	if (ev.metaKey || ev.altKey || ev.ctrlKey || DwtKeyMapMgr.isModifier(key) || key == DwtKeyMapMgr.TAB_KEYCODE)
		return;

	var e = DwtUiEvent.getTarget(ev);
	var view = e ? Dwt.getObjectFromElement(e) : null;
	if (view) {
		view._isDirty = true;
		if (e.tagName.toLowerCase() == "input")
			view._setTitle(e.value);
	}

	return true;
};

ZmGroupView._keyPressHdlr =
function(ev) {
	ev = DwtUiEvent.getEvent(ev);
	if (ev.metaKey || ev.altKey || ev.ctrlKey)
		return;

	var e = DwtUiEvent.getTarget(ev);
	var view = e ? Dwt.getObjectFromElement(e) : null;
	if (view) {
		var charCode = DwtKeyEvent.getCharCode(ev);
		if (charCode == 13 || charCode == 3) {
			view._searchButtonListener(ev);
			return false;
		}
	}
	return true;
};

ZmGroupView.getPrintHtml =
function(contact, abridged, appCtxt) {
	contact = contact.list._realizeContact(contact); // make sure it's a real ZmContact
	var members = contact.getGroupMembers().good.getArray();

	var html = new Array();
	var idx = 0;

	var size = (members.length <= 5 || !abridged)
		? members.length
		: Math.min(members.length, 5);

	html[idx++] = "<table border=0 cellpadding=2 cellspacing=2 width=100%>";
	html[idx++] = "<tr><td style='font-family:Arial; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:bold; background-color:#DDDDDD'>";
	html[idx++] = contact.getFileAs();
	html[idx++] = "</td></tr>";

	for (var i = 0; i < size; i++) {
		html[idx++] = "<tr><td valign=top style='font-family:Arial; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;'>";
		html[idx++] = AjxStringUtil.htmlEncode(members[i].toString());
		html[idx++] = "</td></tr>";
	}
	if (abridged && size < members.length) {
		html[idx++] = "<tr><td valign=top style='font-family:Arial; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;'>";
		html[idx++] = ZmMsg.more;
		html[idx++] = "</td></tr>";
	}
	html[idx++] = "</table>";

	return html.join("");
};



/**
* Creates a group list view for search results
* @constructor
* @class
*
* @param parent			[ZmGroupView]	containing widget
*/
function ZmGroupListView(parent) {
	if (arguments.length == 0) return;
	DwtListView.call(this, parent, "DwtChooserListView", null, this._getHeaderList(parent));
};

ZmGroupListView.prototype = new DwtListView;
ZmGroupListView.prototype.constructor = ZmGroupListView;


ZmGroupListView.prototype.setItems =
function(items) {
	this._resetList();
	this.addItems(items);
	var list = this.getList();
	if (list && list.size() > 0) {
		this.setSelection(list.get(0));
	}
};

ZmGroupListView.prototype._getHeaderList =
function() {
	var headerList = [];
	headerList.push(new DwtListHeaderItem(ZmGroupListView.ID_ICON, null, "Contact", 20));
	headerList.push(new DwtListHeaderItem(ZmGroupListView.ID_NAME, ZmMsg._name, null, 100));
	headerList.push(new DwtListHeaderItem(ZmGroupListView.ID_EMAIL, ZmMsg.email));
	return headerList;
};

// The items are ZmEmailAddress objects
ZmGroupListView.prototype._createItemHtml =
function(item) {
	var div = document.createElement("div");
	div[DwtListView._STYLE_CLASS] = "Row";
	div[DwtListView._SELECTED_STYLE_CLASS] = div[DwtListView._STYLE_CLASS] + '-' + DwtCssStyle.SELECTED;
	div.className = div[DwtListView._STYLE_CLASS];

	var html = [];
	var idx = 0;

	html[idx++] = "<table cellpadding=0 cellspacing=0 border=0 width=100%><tr>";
	for (var i = 0; i < this._headerList.length; i++) {
		var id = this._headerList[i]._id;
		if (id.indexOf(ZmGroupListView.ID_ICON) == 0) {
			html[idx++] = "<td width=";
			html[idx++] = AjxEnv.isIE || AjxEnv.isSafari ? (this._headerList[i]._width + 4): this._headerList[i]._width;
			html[idx++] = ">";
			html[idx++] = AjxImg.getImageHtml(item.icon);
			html[idx++] = "</td>";
		} else if (id.indexOf(ZmGroupListView.ID_NAME) == 0) {
			html[idx++] = "<td width=";
			html[idx++] = AjxEnv.isIE || AjxEnv.isSafari ? (this._headerList[i]._width + 4) : this._headerList[i]._width;
			html[idx++] = "><nobr>";
			html[idx++] = item.name;
			html[idx++] = "</td>";
		} else if (id.indexOf(ZmGroupListView.ID_EMAIL) == 0) {
			html[idx++] = "<td>";
			html[idx++] = item.address;
			html[idx++] = "</td>";
		}
	}
	html[idx++] = "</tr></table>";
	div.innerHTML = html.join("");

	this.associateItemWithElement(item, div, DwtListView.TYPE_LIST_ITEM);
	return div;
};

ZmGroupListView.prototype._itemClicked =
function(clickedEl, ev) {
	// Ignore right-clicks, we don't support action menus
	if (!ev.shiftKey && !ev.ctrlKey && ev.button == DwtMouseEvent.RIGHT) {
		return;
	} else {
		DwtListView.prototype._itemClicked.call(this, clickedEl, ev);
	}
};
