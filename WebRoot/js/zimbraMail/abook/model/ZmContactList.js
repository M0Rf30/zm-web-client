/*
 * ***** BEGIN LICENSE BLOCK *****
 * Zimbra Collaboration Suite Web Client
 * Copyright (C) 2004, 2005, 2006, 2007, 2008 Zimbra, Inc.
 * 
 * The contents of this file are subject to the Yahoo! Public License
 * Version 1.0 ("License"); you may not use this file except in
 * compliance with the License.  You may obtain a copy of the License at
 * http://www.zimbra.com/license.
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 * ***** END LICENSE BLOCK *****
 */

/**
 * Create a new, empty contact list.
 * @constructor
 * @class
 * This class represents a list of contacts. In general, the list is the result of a
 * search. It may be the result of a GetContactsRequest, which returns all of the user's
 * local contacts. That list is considered to be canonical.
 * <p>
 * Loading of all local contacts has been optimized by delaying the creation of ZmContact objects until
 * they are needed. That has a big impact on IE, and not much on Firefox. Loading a subset
 * of attributes did not have much impact on load time, probably because a large majority
 * of contacts contain only those minimal fields.</p>
 *
 * @author Conrad Damon
 *
 * @param search	[ZmSearch]*		search that generated this list
 * @param isGal		[boolean]*		if true, this is a list of GAL contacts
 * @param type		[constant]*		item type
 */
ZmContactList = function(search, isGal, type) {

	if (arguments.length == 0) { return; }
	type = type || ZmItem.CONTACT;
	ZmList.call(this, type, search);

	this.isGal = (isGal === true);
	this.isCanonical = false;
	this.isLoaded = false;

	this._app = appCtxt.getApp(ZmApp.CONTACTS);
	this._emailToContact = this._app._byEmail;
	this._imAddressToContact = this._app._byIM;
	this._phoneToContact = this._app._byPhone;
	
	this._loadCount = 0;
	this._myCard = null;
};

ZmContactList.prototype = new ZmList;
ZmContactList.prototype.constructor = ZmContactList;


// Constants

// Load contacts in chunks so browser remains reasonably responsive.
// To increase browser responsiveness, lower the chunk size and increase the
// delay (of course, it will then take longer to load the contacts).
ZmContactList.MAX_LOAD_COUNT	= AjxEnv.isIE ? 100 : 500;	// chunk size for loading contacts
ZmContactList.LOAD_PAUSE		= AjxEnv.isIE ? 500 : 250;	// delay between chunks

ZmContactList.prototype.toString =
function() {
	return "ZmContactList";
};

ZmContactList.prototype.addLoadedCallback =
function(callback) {
	if (this.isLoaded) {
		callback.run();
		return;
	}
	if (!this._loadedCallbacks) {
		this._loadedCallbacks = [];
	}
	this._loadedCallbacks.push(callback);
};

ZmContactList.prototype._finishLoading =
function() {
	this.isLoaded = true;
	if (this._loadedCallbacks) {
		var callback;
		while (callback = this._loadedCallbacks.shift()) {
			callback.run();
		}
	}
};

/**
* Retrieves the contacts from the back end, and parses the response. The list is then sorted.
* This method is used only by the canonical list of contacts, in order to load their content.
* <p>
* Loading a minimal set of attributes did not result in a significant performance gain.</p>
*/
ZmContactList.prototype.load =
function(callback, errorCallback) {
	// only the canonical list gets loaded
	DBG.println(AjxDebug.DBG1, "loading contacts");
	this.isCanonical = true;
	var jsonObj = {GetContactsRequest:{_jsns:"urn:zimbraMail", sortBy:"nameAsc"}};
	var respCallback = new AjxCallback(this, this._handleResponseLoad, [callback]);
	DBG.timePt("requesting contact list", true);
	appCtxt.getAppController().sendRequest({jsonObj:jsonObj, asyncMode:true, noBusyOverlay:true,
											callback:respCallback, errorCallback:errorCallback});
};

ZmContactList.prototype._handleResponseLoad =
function(callback, result) {
	DBG.timePt("got contact list");
	var list = result.getResponse().GetContactsResponse.cn;
	if (list) {
		if (list.length > ZmContactList.MAX_LOAD_COUNT) {
			this._loadAction = new AjxTimedAction(this, this._smartLoad, [list]);
		}
		this.set(list);
	}
	// user has no contacts
	else {
		this._finishLoading();
	}

	if (callback) {
		callback.run();
	}
};

ZmContactList.prototype.set =
function(list) {
	this.clear();
	this._smartLoad(list);
};

ZmContactList.prototype._smartLoad =
function(list) {
	DBG.timePt("loading contacts - " + this._loadCount);
	var diff = list.length - this._loadCount;
	var limit = diff < ZmContactList.MAX_LOAD_COUNT ? (diff + this._loadCount) :
													  (ZmContactList.MAX_LOAD_COUNT + this._loadCount);

	for (var i = this._loadCount; i < limit; i++) {
		var contact = list[i];
		if (!contact._attrs) contact._attrs = {}; // handle empty contacts
		// note that we don't create a ZmContact here (optimization)
		contact.list = this;
		this._updateHashes(contact, true);
		var fn = [], fl = [];
		if (contact._attrs[ZmContact.F_firstName])	{ fn.push(contact._attrs[ZmContact.F_firstName]); }
		if (contact._attrs[ZmContact.F_middleName])	{ fn.push(contact._attrs[ZmContact.F_middleName]); }
		if (contact._attrs[ZmContact.F_lastName])	{ fn.push(contact._attrs[ZmContact.F_lastName]); }
		if (fn.length) {
			contact._attrs[ZmContact.X_fullName] = fn.join(" ");
		}
		if (contact._attrs[ZmContact.F_firstName])	{ fl.push(contact._attrs[ZmContact.F_firstName]); }
		if (contact._attrs[ZmContact.F_lastName])	{ fl.push(contact._attrs[ZmContact.F_lastName]); }
		contact._attrs[ZmContact.X_firstLast] = fl.join(" ");
		this.add(contact);
	}

	if (i < (list.length - 1) && this._loadAction) {
		this._loadCount = i;
		AjxTimedAction.scheduleAction(this._loadAction, ZmContactList.LOAD_PAUSE);
	} else {
		DBG.timePt("done loading contacts");
		this._finishLoading();
	}
};

/*
* Converts an anonymous contact object (contained by the JS returned by load request)
* into a ZmContact, and updates the containing list if it is the canonical one.
*
* @param contact	[object]	a contact
* @param idx		[int]*		index of contact in canonical list
*/
ZmContactList.prototype._realizeContact =
function(contact, idx) {
	if (contact instanceof ZmContact) { return contact; }

	var args = {list:this};
	var obj = eval(ZmList.ITEM_CLASS[this.type]);
	var realContact = obj ? obj.createFromDom(contact, args) : null;

	if (this.isCanonical) {
		var a = this.getArray();
		idx = idx || this._getIndexById(contact.id);
		a[idx] = realContact;
		this._updateHashes(realContact, true);
		this._idHash[contact.id] = realContact;
	}

	return realContact;
};

/*
* Finds the array index for the contact with the given ID.
*
* @param id		[int]		a contact ID
*/
ZmContactList.prototype._getIndexById =
function(id) {
	var a = this.getArray();
	for (var i = 0; i < a.length; i++) {
		if (a[i].id == id)
			return i;
	}
	return null;
};

/**
* Override in order to make sure the contacts have been realized. We don't
* call realizeContact() since this is not the canonical list.
*
* @param offset		[int]		starting index
* @param limit		[int]		size of sublist
*/
ZmContactList.prototype.getSubList =
function(offset, limit, folderId) {
	if (folderId && this.isCanonical) {
		// only collect those contacts that belong to the given folderId if provided
		var newlist = new Array();
		var sublist = this.getArray();
		var offsetCount = 0;
		this.setHasMore(false);

		for (var i = 0; i < sublist.length; i++) {
			sublist[i] = this._realizeContact(sublist[i], i);
			var folder = appCtxt.getById(sublist[i].folderId);
			if (folder && folder.nId == ZmOrganizer.normalizeId(folderId)) {
				if (offsetCount >= offset) {
					if (newlist.length == limit) {
						this.setHasMore(true);
						break;
					}
					newlist.push(sublist[i]);
				}
				offsetCount++;
			}
		}

		return AjxVector.fromArray(newlist);
	} else {
		var vec = ZmList.prototype.getSubList.call(this, offset, limit);
		if (vec) {
			var a = vec.getArray();
			for (var i = 0; i < a.length; i++) {
				a[i] = this._realizeContact(a[i], offset + i);
			}
		}

		return vec;
	}
};

/**
* Override in order to make sure the contact has been realized. Canonical list only.
* Returns a ZmContact.
*
* @param id		[int]		a contact ID
*/
ZmContactList.prototype.getById =
function(id) {
	if (!id || !this.isCanonical) return null;

	var contact = this._idHash[id];
	return contact ? this._realizeContact(contact) : null;
};

/**
* Returns the contact with the given address, if any. Canonical list only.
*
* @param address	[string]	an email address
*/
ZmContactList.prototype.getContactByEmail =
function(address) {
	if (!address || !this.isCanonical) return null;

	var contact = this._emailToContact[address.toLowerCase()];
	if (contact) {
		contact = this._realizeContact(contact);
		contact._lookupEmail = address;	// so caller knows which address matched
		return contact;
	} else {
		return null;
	}
};

ZmContactList.prototype.getContactByIMAddress = function(addr) {
	var contact = this._imAddressToContact[addr.toLowerCase()];
	return contact ? this._realizeContact(contact) : null;
};

/**
* Returns information about the contact with the given phone number, if any.
* Canonical list only.
*
* @param phone	[string]	a phone number
* @return	[Object]	an object with contact = the contact & field = the field with the matching phone number
*/
ZmContactList.prototype.getContactByPhone =
function(phone) {
	if (!phone || !this.isCanonical) return null;

	var digits = this._getPhoneDigits(phone);
	var data = this._phoneToContact[digits];
	if (data) {
		data.contact = this._realizeContact(data.contact);
		return data;
	} else {
		return null;
	}
};

/**
* Moves a list of items to the given folder.
* <p>
* This method calls the base class for normal "moves" UNLESS we're dealing w/
* shared items (or folder) in which case we must send a CREATE request for the
* given folder to the server followed by a hard delete of the shared contact
* (this is temporary, until we get better server support).
* </p>
*
* @param items		[Array]			a list of items to move
* @param folder		[ZmFolder]		destination folder
* @param attrs		[Object]		additional attrs for SOAP command
*/
ZmContactList.prototype.moveItems =
function(items, folder, attrs, outOfTrash) {
	if (!(items instanceof Array)) {
		items = [items];
	}

	var moveBatchCmd = new ZmBatchCommand(true, null, true);
	var loadBatchCmd = new ZmBatchCommand(true, null, true);
	var softMove = [];
	var hardMove = [];

	// if the folder we're moving contacts to is a shared folder, then dont bother
	// checking whether each item is shared or not
	for (var i = 0; i < items.length; i++) {
		var contact = items[i];

		if (contact.isReadOnly()) { continue; }

		if (contact.isShared() || folder.link) {
			hardMove.push(contact);
			if (contact.isLoaded) {
				moveBatchCmd.add(this._getCopyCmd(contact, folder));
			} else {
				//var loadCallback = new AjxCallback(this, this._handleResponseBatchLoad, [moveBatchCmd, folder]);
				//var cmd = new AjxCallback(contact, contact.load, [loadCallback, null]);
				//loadBatchCmd.add(cmd);
                contact.load(null,null);
                moveBatchCmd.add(this._getCopyCmd(contact, folder));

            }
		} else {
			softMove.push(contact);
		}
	}

	if (hardMove.length > 0) {
		if (loadBatchCmd.size()/*loadBatchCmd._cmds.length*/) {
			var respCallback = new AjxCallback(this, this._handleResponseLoadMove, [moveBatchCmd, hardMove]);
			loadBatchCmd.run(respCallback);
		} else {
			var deleteCmd = new AjxCallback(this, this._itemAction, [{items:hardMove, action:"delete"}]);
			moveBatchCmd.add(deleteCmd);

			var respCallback = new AjxCallback(this, this._handleResponseMoveBatchCmd);
			moveBatchCmd.run(respCallback);
		}
	}

	// for "soft" moves, handle moving out of Trash differently
	if (softMove.length > 0) {
		attrs = attrs || {};
		attrs.l = folder.id;

		var respCallback = (outOfTrash)
			? (new AjxCallback(this, this._handleResponseMoveItems, folder))
			: null;
		this._itemAction({items: items, action: "move", attrs: attrs, callback: respCallback});
	}
};

ZmContactList.prototype._handleResponseMoveBatchCmd =
function(result) {
	var resp = result.getResponse().BatchResponse.ContactActionResponse;
	// XXX: b/c the server does not return notifications for actions done on
	//      shares, we manually notify - TEMP UNTIL WE GET BETTER SERVER SUPPORT
	var ids = resp[0].action.id.split(",");
	for (var i = 0; i < ids.length; i++) {
		var contact = appCtxt.cacheGet(ids[i]);
		if (contact && contact.isShared()) {
			contact.notifyDelete();
			appCtxt.getItemCache().clear(ids[i]);
		}
	}
};

ZmContactList.prototype._handleResponseLoadMove =
function(moveBatchCmd, hardMove) {
	var deleteCmd = new AjxCallback(this, this._itemAction, [{items:hardMove, action:"delete"}]);
	moveBatchCmd.add(deleteCmd);

	var respCallback = new AjxCallback(this, this._handleResponseMoveBatchCmd);
	moveBatchCmd.run(respCallback);
};

ZmContactList.prototype._handleResponseBatchLoad =
function(batchCmd, folder, result, contact) {
	batchCmd.add(this._getCopyCmd(contact, folder));
};

ZmContactList.prototype._getCopyCmd =
function(contact, folder) {
	var temp = new ZmContact(null, this);
	for (var j in contact.attr) {
		temp.attr[j] = contact.attr[j];
	}
	temp.attr[ZmContact.F_folderId] = folder.id;

	return new AjxCallback(temp, temp.create, [temp.attr]);
};

/**
* Deletes contacts after checking that this is not a GAL list.
*
* @param items		[Array]			list of contacts to delete
* @param hardDelete	[boolean]		whether to force physical removal of items
* @param attrs		[Object]		hash of additional attrs for SOAP command
*/
ZmContactList.prototype.deleteItems =
function(items, hardDelete, attrs) {
	if (this.isGal) {
		DBG.println(AjxDebug.DBG1, "Cannot delete GAL contacts");
		return;
	}
	ZmList.prototype.deleteItems.call(this, items, hardDelete, attrs);
};

ZmContactList.prototype.setIsGal =
function(isGal) {
	this.isGal = isGal;
};

ZmContactList.prototype.moveLocal =
function(items, folderId) {
	// don't remove any contacts from the canonical list
	if (!this.isCanonical)
		ZmList.prototype.moveLocal.call(this, items, folderId);
	if (folderId == ZmFolder.ID_TRASH) {
		for (var i = 0; i < items.length; i++) {
			this._updateHashes(items[i], false);
		}
	}
};

ZmContactList.prototype.deleteLocal =
function(items) {
	ZmList.prototype.deleteLocal.call(this, items);
	for (var i = 0; i < items.length; i++) {
		this._updateHashes(items[i], false);
	}
};

// Handle modified contact.
ZmContactList.prototype.modifyLocal =
function(item, details) {
	if (details) {
		// notify item's list
		details.items = [item];
		this._notify(ZmEvent.E_MODIFY, details);
	}

	var contact = details.contact;
	if (this.isCanonical) {
		// Remove traces of old contact - NOTE: we pass in null for the ID on
		// PURPOSE to avoid overwriting the existing cached contact
		var oldContact = new ZmContact(null, this);
		oldContact.id = details.contact.id;
		oldContact.attr = details.oldAttr;
		this._updateHashes(oldContact, false);

		// add new contact to hashes
		this._updateHashes(contact, true);
	}

	// place in correct position in list
	if (details.fileAsChanged) {
		this.remove(contact);
		this.add(contact, this._sortIndex(contact));
	}

	// reset addrbook property
	if (contact.addrbook && (contact.addrbook.id != contact.folderId)) {
		contact.addrbook = appCtxt.getById(contact.folderId);
	}
};

ZmContactList.prototype.createLocal =
function(item) {
	this._updateHashes(item, true);
};

ZmContactList.prototype._updateHashes =
function(contact, doAdd) {

	this._app.updateCache(contact, doAdd);

    // Update email hash.
	for (var i = 0; i < ZmContact.F_EMAIL_FIELDS.length; i++) {
		var email = ZmContact.getAttr(contact, ZmContact.F_EMAIL_FIELDS[i]);
		if (email) {
			if (doAdd)
				this._emailToContact[email.toLowerCase()] = contact;
			else
				delete this._emailToContact[email.toLowerCase()];
		}
	}

	// Update phone hash.
	if (appCtxt.get(ZmSetting.VOICE_ENABLED)) {
		for (var i = 0; i < ZmContact.F_PHONE_FIELDS.length; i++) {
			var field = ZmContact.F_PHONE_FIELDS[i];
			var phone = ZmContact.getAttr(contact, field);
			if (phone) {
				var digits = this._getPhoneDigits(phone);
				if (digits) {
					if (doAdd)
						this._phoneToContact[digits] = {contact: contact, field: field};
					else
						delete this._phoneToContact[digits];
				}
			}
		}
	}

	// Update IM hash.
	if (appCtxt.get(ZmSetting.IM_ENABLED)) {
		for (var i = 0; i < ZmContact.F_IM_FIELDS.length; i++) {
			var imaddr = ZmContact.getAttr(contact, ZmContact.F_IM_FIELDS[i]);
			if (imaddr) {
				imaddr = imaddr.toLowerCase();
				if (doAdd)
					this._imAddressToContact[imaddr] = contact;
				else
					delete this._imAddressToContact[imaddr];
			}
		}
	}
};

// Strips all non-digit characters from a phone number.
ZmContactList.prototype._getPhoneDigits =
function(phone) {
	return phone.replace(/[^\d]/g, '');
};

// Returns the position at which the given contact should be inserted in this list.
ZmContactList.prototype._sortIndex =
function(contact) {
	var a = this._vector.getArray();
	for (var i = 0; i < a.length; i++)
		if (ZmContact.compareByFileAs(a[i], contact) > 0)
			return i;
	return a.length;
};

ZmContactList.prototype._handleResponseModifyItem =
function(item, result) {
	// NOTE: we overload and do nothing b/c base class does more than we want
	//       (since everything is handled by notifications)
};
