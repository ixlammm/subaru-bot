const _md5 = require('../utils.js').md5
const _ecbCrypt = require('../utils.js').ecbCrypt

module.exports = class Track {
	constructor(body){
		this.body = body;
	}

	getDownloadUrl(format){
	if (!this.body.MD5_ORIGIN) throw new Error("Authentication needed to get download URL")
	var urlPart = this.body.MD5_ORIGIN+"¤"+format+"¤"+this.body.SNG_ID+"¤"+this.body.MEDIA_VERSION
	var md5val = _md5(urlPart)
	urlPart = _ecbCrypt('jo6aey6haid2Teih', md5val+"¤"+urlPart+"¤")
	return "https://e-cdns-proxy-" + this.body.MD5_ORIGIN.substring(0, 1) + ".dzcdn.net/mobile/1/" + urlPart
}
}
