const request = require('request-promise')
const tough = require('tough-cookie');
const Track = require('./obj/Track.js')
const Album = require('./obj/Album.js');
const { get } = require('request');
const getBlowfishKey = require('./utils.js').getBlowfishKey
const decryptChunk = require('./utils.js').decryptChunk
const sleep = require('./utils.js').sleep
const axios = require('axios')

module.exports = class Deezer {
  constructor(){
    this.apiUrl = `https://www.deezer.com/ajax/gw-light.php`
    this.legacyApiUrl = `https://api.deezer.com/`
		this.mobileApiUrl = `https://api.deezer.com/1.0/gateway.php`
    this.httpHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36",
      "Content-Language": "en-US",
      "Cache-Control": "max-age=0",
      "Accept": "*/*",
      "Accept-Charset": "utf-8,ISO-8859-1;q=0.7,*;q=0.3",
      "Accept-Language": "en-US,en;q=0.9,en-US;q=0.8,en;q=0.7",
      "Connection": 'keep-alive'
    }
    this.albumPicturesHost = `https://e-cdns-images.dzcdn.net/images/cover/`
    this.artistPicturesHost = `https://e-cdns-images.dzcdn.net/images/artist/`
    this.user = {
			id: 0,
			name: "Not Logged In",
			picture: "https://e-cdns-images.dzcdn.net/images/user/250x250-000000-80-0-0.jpg"
		}
    this.jar = request.jar()
  }

	getCookies(){
    return this.jar.getCookies("https://www.deezer.com")
  }

  getCookieString(){
    return this.jar.getCookieString("https://www.deezer.com")
  }

  setCookies(cookies){
    JSON.parse("{\"a\": "+cookies+"}").a.forEach(x => {
      this.jar.setCookie(tough.Cookie.fromJSON(x).toString(), "https://www.deezer.com")
    })
  }

  async getToken(){
    var tokenData = await this.apiCall('deezer.getUserData')
    return tokenData.results.checkForm
  }

	async getSID(){
		await request({
			uri: `https://www.deezer.com`,
			method: 'GET',
			jar: this.jar,
			headers: this.httpHeaders
		})
		let cookieString = this.getCookieString()
		this.sid = cookieString.match(/sid=([^;]*)/g)[0].substring(4)
		return this.sid
	}

  // Simple function to request data from the hidden API (gw-light.php)
  async apiCall(method, args = {}){
		try{
			var result = await request({
				uri: this.apiUrl,
				method: 'POST',
				qs: {
					api_version: "1.0",
					api_token: (method === "deezer.getUserData" ? "null" : await this.getToken()),
					input: "3",
					method: method
				},
				body: args,
				jar: this.jar,
				json: true,
				headers: this.httpHeaders
			})
		}catch (err){
			return this.apiCall(method, args)
		}
		return result
  }

  // Simple function to request data from the legacy API (api.deezer.com)
  async legacyApiCall(method, args = {}){
		try{
	    var result = await request({
	      uri: `${this.legacyApiUrl}${method}`,
	      method: 'GET',
	      qs: args,
	      jar: this.jar,
	      json: true,
	      headers: this.httpHeaders,
	      timeout: 30000
	    })
		}catch (err){
			return this.legacyApiCall(method, args)
		}
    if (result.error){
      if (result.error.code == 4){
        await sleep(500)
        return await this.legacyApiCall(method, args)
      }else{
        throw new Error(`${result.error.type}: ${result.error.message}`)
      }
    }
    return result
  }

	// Simple function to request data from the mobile API (gateway.php)
  async mobileApiCall(method, args = {}){
		try{
			var result = await request({
				uri: this.mobileApiUrl,
				method: 'POST',
				qs: {
					api_key: "4VCYIJUCDLOUELGD1V8WBVYBNVDYOXEWSLLZDONGBBDFVXTZJRXPR29JRLQFO6ZE",
					sid: (this.sid ? this.sid : await this.getSID()),
					method: method,
					output: "3",
					input: "3"
				},
				body: args,
				jar: this.jar,
				json: true,
				headers: this.httpHeaders
			})
		}catch (err){
			return this.apiCall(method, args)
		}
		return result
  }

  // Login function
  async login(mail, password, reCaptchaToken){
    try{
      // The new login page requires a checkFormLogin field
      // We can get that from the hidden API
      var checkFormLogin = await this.apiCall("deezer.getUserData")
      // Now we'll ask to login
      var login = await request({
        method: 'POST',
        url: `https://www.deezer.com/ajax/action.php`,
        form: {
          type:'login',
          mail: mail,
          password: password,
          checkFormLogin: checkFormLogin.results.checkFormLogin,
          reCaptchaToken: reCaptchaToken
        },
        headers: {
          ...this.httpHeaders,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        jar: this.jar,
        withCredentials: true
      })
      if (!login.includes('success'))
        throw new Error(`Generic error: ${login}`)
      // Next we'll get the user data, so we can display playlists the name, images from the user
      var userData = await this.apiCall(`deezer.getUserData`)
      this.user = {
        email: mail,
        id: userData.results.USER.USER_ID,
        name: userData.results.USER.BLOG_NAME,
        picture: userData.results.USER.USER_PICTURE ? `https://e-cdns-images.dzcdn.net/images/user/${userData.results.USER.USER_PICTURE}/250x250-000000-80-0-0.jpg` : "https://e-cdns-images.dzcdn.net/images/user/250x250-000000-80-0-0.jpg"
      }
			let cookieString = this.getCookieString()
			this.user.arl = cookieString.match(/arl=([^;]*)/g)[0].substring(4)
      return true
    } catch(err){
      throw new Error(`Can't connect to Deezer: ${err.message}`)
    }
  }

  // Login via cookie function
  // Uses cookie format from getCookies()
  async loginViaCookies(cookies, email){
    try{
      this.setCookies(cookies)
      var userData = await this.apiCall(`deezer.getUserData`)
      if (!userData.results.USER.USER_ID) throw new Error('ARL expired, please login again or get the new ARL.')
      this.user = {
        email: email,
        id: userData.results.USER.USER_ID,
        name: userData.results.USER.BLOG_NAME,
        picture: userData.results.USER.USER_PICTURE ? `https://e-cdns-images.dzcdn.net/images/user/${userData.results.USER.USER_PICTURE}/250x250-000000-80-0-0.jpg` : "https://e-cdns-images.dzcdn.net/images/user/250x250-000000-80-0-0.jpg"
      }
			let cookieString = this.getCookieString()
			this.user.arl = cookieString.match(/arl=([^;]*)/g)[0].substring(4)
      return true
    } catch(err){
      throw new Error(`Can't connect to Deezer: ${err.message}`)
    }
  }

  // Login via arl cookie function
  // Uses arl cookie value
  async loginViaArl(arl){
    try{
      var creation = new Date()
      var lastUsed = new Date()
      var expires = new Date(creation.valueOf())
      expires.setDate(expires.getDate() + 180)
      this.setCookies(`[{"key":"arl","value":"${arl}","expires":"${expires.toISOString()}","maxAge":15552000,"domain":"deezer.com","path":"/","httpOnly":true,"hostOnly":false,"creation":"${creation.toISOString()}","lastAccessed":"${lastUsed.toISOString()}"}]`)
      var userData = await this.apiCall(`deezer.getUserData`)
      if (!userData.results.USER.USER_ID){
				throw new Error('ARL is not valid')
			}
      this.user = {
        id: userData.results.USER.USER_ID,
        name: userData.results.USER.BLOG_NAME,
        picture: userData.results.USER.USER_PICTURE ? `https://e-cdns-images.dzcdn.net/images/user/${userData.results.USER.USER_PICTURE}/250x250-000000-80-0-0.jpg` : "https://e-cdns-images.dzcdn.net/images/user/250x250-000000-80-0-0.jpg",
				arl: arl
			}
      return true
    } catch(err){
      throw new Error(`Can't connect to Deezer: ${err.message}`)
    }
  }

  async getDecryptedStream(track) {
    const resp = await axios({
      method: 'get',
      url: track.getDownloadUrl(1),
      responceType: 'stream'
    });
    return this.decryptDownload(resp.data, track.id);
  }

  async getTrack(id){
    var body
    if (id<0){
      body = await this.apiCall(`song.getData`, {sng_id: id})
    }else{
      //body = await this.apiCall(`deezer.pageTrack`, {sng_id: id})
      body = await this.mobileApiCall(`song_getData`, {sng_id: id})
      body.results = body.results
    }
    return new Track(body.results)
  }

	async getTrackMD5(id){
		var body = await this.mobileApiCall(`song_getData`, {sng_id: id})
		return body;
	}

  async getTracks(ids){
    var tracksArray = []
    var body = await this.apiCall(`song.getListData`, {sng_ids: ids})
		var errors = 0
		for(var i=0; i<ids.length; i++){
			if (ids[i] != 0) {
				tracksArray.push(new Track(body.results.data[i-errors]))
			}else{
				errors++
				tracksArray.push({
					id: 0,
			    title: '',
			    duration: 0,
			    MD5: 0,
			    mediaVersion: 0,
			    filesize: 0,
			    album: {id: 0, title: "", picture: ""},
			    artist: {id: 0, name: ""},
			    artists: [{id: 0, name: ""}],
			    recordType: -1,
				})
			}

		}
    return tracksArray
  }

  async getAlbum(id){
    var body = await this.apiCall(`album.getData`, {alb_id: id})
    /*
    Alternative query, currently not used
      var body = await this.apiCall(`deezer.pageAlbum`, {alb_id: id, lang: 'en'})
			if (body.results.SONGS) body.results.DATA.SONGS = body.results.SONGS
			body.results = body.results.DATA
    */
    return new Album(body.results)
  }

  async getAlbumTracks(id){
    var tracksArray = []
    var body = await this.apiCall(`song.getListByAlbum`, {alb_id: id, nb: -1})
    body.results.data.forEach((track, index)=>{
      let _track = new Track(track)
      _track.position = index
      tracksArray.push(_track)
    })
    return tracksArray
  }

  async getArtist(id){
    var body = await this.apiCall(`deezer.pageArtist`, {art_id: id})
    return body
  }

  async getPlaylist(id){
    var body = await this.apiCall(`deezer.pagePlaylist`, {playlist_id: id})
    return body
  }

  async getPlaylistTracks(id){
    var tracksArray = []
    var body = await this.apiCall(`playlist.getSongs`, {playlist_id: id, nb: -1})
    body.results.data.forEach((track, index)=>{
      let _track = new Track(track)
      _track.position = index
      tracksArray.push(_track)
    })
    return tracksArray
  }

  async getArtistTopTracks(id){
    var tracksArray = []
    var body = await this.apiCall(`artist.getTopTrack`, {art_id: id, nb: 100})
    body.results.data.forEach((track, index)=>{
      let _track = new Track(track)
      _track.position = index
      tracksArray.push(_track)
    })
    return tracksArray
  }

  async getArtistDiscography(id){
    var body = await this.apiCall(`album.getDiscography`, {art_id: id, nb: 500, nb_songs: -1, start: 0})
    return body.results.data
  }

  async getLyrics(id){
    var body = await this.apiCall(`song.getLyrics`, {sng_id: id})
    var lyr = {}
		if (body.results.LYRICS_TEXT){
			lyr.unsyncLyrics = {
				description: "",
				lyrics: body.results.LYRICS_TEXT
			}
		}
		if (body.results.LYRICS_SYNC_JSON){
			lyr.syncLyrics = ""
			for(let i=0; i < body.results.LYRICS_SYNC_JSON.length; i++){
				if(body.results.LYRICS_SYNC_JSON[i].lrc_timestamp){
					lyr.syncLyrics += body.results.LYRICS_SYNC_JSON[i].lrc_timestamp + body.results.LYRICS_SYNC_JSON[i].line+"\r\n";
				}else if(i+1 < body.results.LYRICS_SYNC_JSON.length){
					lyr.syncLyrics += body.results.LYRICS_SYNC_JSON[i+1].lrc_timestamp + body.results.LYRICS_SYNC_JSON[i].line+"\r\n";
				}
			}
		}
    return lyr
  }

  async legacyGetUserPlaylists(id){
		if (id == 0) return {}
    var body = await this.legacyApiCall(`user/${id}/playlists`, {limit: -1})
		if (body.data[0] && body.data[0].title == "Loved tracks")
			body.data.shift()
    return body
  }

  async legacyGetTrack(id){
    var body = await this.legacyApiCall(`track/${id}`)
    return body
  }

  async legacyGetTrackByISRC(isrc){
    var body = await this.legacyApiCall(`track/isrc:${isrc}`)
    return body
  }

  async legacyGetChartsTopCountry(){
    return await this.legacyGetUserPlaylists('637006841')
  }

  async legacyGetPlaylist(id){
    var body = await this.legacyApiCall(`playlist/${id}`)
    return body
  }

  async legacyGetPlaylistTracks(id){
    var body = await this.legacyApiCall(`playlist/${id}/tracks`, {limit: -1})
    return body
  }

  async legacyGetAlbum(id){
    var body = await this.legacyApiCall(`album/${id}`)
    return body
  }

  async legacyGetAlbumByUPC(upc){
    var body = await this.legacyApiCall(`album/upc:${upc}`)
    return body
  }

  async legacyGetAlbumTracks(id){
    var body = await this.legacyApiCall(`album/${id}/tracks`, {limit: -1})
    return body
  }

  async legacyGetArtistAlbums(id){
    var body = await this.legacyApiCall(`artist/${id}/albums`, {limit: -1})
    return body
  }

  async legacyGetArtist(id){
    var body = await this.legacyApiCall(`artist/${id}`, {limit: -1})
    return body
  }

  async legacySearch(term, type, limit = 30, index = 0){
    var body = await this.legacyApiCall(`search/${type}`, {q: term, limit: limit, index: index})
    if(body.error) {
      throw new Error("Wrong search type/text: " + text)
    }
    return body
  }

  decryptDownload(source, trackId) {
  	var chunk_size = 2048
  	var part_size = 0x1800
  	var blowFishKey = getBlowfishKey(trackId)
  	var i = 0
  	var position = 0

  	var destBuffer = Buffer.alloc(source.length)
  	destBuffer.fill(0)

  	while(position < source.length) {
  		var chunk
  		if ((source.length - position) >= 2048)
  			chunk_size = 2048
  		else
  			chunk_size = source.length - position
  		chunk = Buffer.alloc(chunk_size)
  		let chunkString
  		chunk.fill(0)
  		source.copy(chunk, 0, position, position + chunk_size)
  		if(i % 3 > 0 || chunk_size < 2048)
  			chunkString = chunk.toString('binary')
  		else
  			chunkString = decryptChunk(chunk, blowFishKey)
  		destBuffer.write(chunkString, position, chunkString.length, 'binary')
  		position += chunk_size
  		i++
  	}
  	return destBuffer
  }
}
