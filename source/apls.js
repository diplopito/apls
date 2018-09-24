var Apls = (function () {

	var version = '0.31';
	
	/* Check that Amplitude is defined */
	if (typeof Amplitude == 'undefined') {
		console.log('Apls requires Amplitude.js to run.');
		return
	}

	/* 
	==================
	playlist & options 
	==================
	@pls: Playlist id
	@options: {
		refreshDivs: bool to refresh main Divs or leave it to dev
		mainAlbum: div for album cover
		mainSong: div with class song. Contains song title
		mainArtist: div with class artist. Contains artist name
		continuous: bool to play endlessly
		playOne: bool to play only one song
		shuffle: bool to play shuffled
		autoplay: bool to start playing asap
		tracks: array with tracks as objects
	}
	@plsShuffled: Array to store the ghost shuffled playlist
	@plsShuffledIndex: Index for keeping track of @plsShuffled
	@isContinuous: bool. Determines if user wants to play endlessly the playlist
	@isPaused: bool. Toggles play state (default false)
	@isPlayOne: bool. Toggles play only one song state (default false)
	@isRefreshDivs: bool. Dev wants Apls to handle the main Divs (or not)
	@isRepeat: bool. Repeat endlessly the current playing song (false by default)
	@isShuffle: bool. Play shuffled (or not)
	*/
	var pls,
		options = {},
		plsShuffled = [],
		plsShuffledIndex = 0,
		isContinuous,
		isPaused = false,
		isPlayOne = false,
		isRefreshDivs,
		isRepeat = false,
		isShuffle;

	/* 
	==========
	Start Apls 
	==========
	@playlist: required. ID of playlist
	@opts: optional. Array with options
	*/
	function init(playlist, opts = {}) {

		/* Check that @playlist exist */
		pls = document.getElementById(playlist);
		if (!pls) {
			console.log('Playlist not found');
			return
		}

		/* Fresh start */
		clearSelected();

		/* Process the users options */

		/* Generate the playlist if array set in options */
		if (opts.tracks && Array.isArray(tracks)) utilsAddNewTracks(tracks);

		/* Shall we refresh the main divs? */
		isRefreshDivs = opts.refreshDivs || true;
		options.mainAlbum = opts.mainAlbum || 'mainAlbum';
		options.mainSong = opts.mainSong || 'mainSong';
		options.mainArtist = opts.mainArtist || 'mainArtist';

		/* Play endlessly */
		isContinuous = opts.continuous || false;

		/* Play only one song */
		isPlayOne = opts.playOne || false;

		/* Play shuffled */
		isShuffle = opts.shuffle || false;
		if (isShuffle) setPlsShuffled();

		/* Start playing now */
		if (opts.autoplay) play();

	}

	/* Set arrow keys left and right to move along the playlist */
	document.addEventListener("keydown", function (e) {
		switch (e.keyCode) {

			case 37:
				Apls.playPrev();
				break;

			case 39:
				Apls.playNext();
				break;

		}
	});

	/* Reset main divs */
	function clearDivs(divs) {
		var clear = divs.map(function (div) {
			var d = document.getElementById(div);
			if (d) d.innerHTML = "";
		});
	}

	/* Clear any LI with class 'selected' in playlist */
	function clearSelected() {
		var ctrl = pls.querySelectorAll('.selected');
		var len = ctrl.length;
		if (len > 0) {
			var i = 0;
			for (i; i < len; i++) {
				ctrl[i].classList.remove('selected');
			}
		}
	}

	/* Fire event "PlayEnd" */
	function firePlayEnd() {
		var event = new Event("playEnd");
		document.dispatchEvent(event);
	}

	/* Get continuous playing mode */
	function getContinuous() {
		return isContinuous;
	}

	/* Get pause state */
	function getPaused() {
		return isPaused;
	}

	/* Get play one state */
	function getPlayOne() {
		return isPlayOne;
	}

	/* Get plsShuffled */
	function getPlsShuffled() {
		return plsShuffled;
	}

	/* Get repeat mode state */
	function getRepeat() {
		return isRepeat;
	}

	/* Get shuffle mode state */
	function getShuffle() {
		return isShuffle;
	}

	/* Get current playlist id */
	function getPlaylist() {
		return pls.id;
	}

	/* Get Apls version */
	function getVersion() {
		return version;
	}

	/* Pause playing */
	function pause() {
		isPaused = true;
		Amplitude.pause();
	}

	/* 
	====
	Play
	====
	Juggling method. 
	With no parameter:
	- If (isPaused), resumes the current playing track;
	- If playing shuffled, plays the first song in plsShuffled
	- If nothing is playing, plays the first song in playlist

	With track parameter:
	Toggles the ".selected" class (used for navigating along the playlist) and applies it to the new playing track

	If (isRefreshDivs) updates the main divs
	*/
	function play(track = '') {

		if (!track) {
			if (isPaused) {
				Amplitude.play();
				isPaused = false;
			} else {
				if (isShuffle) {
					play(plsShuffled[0]);
				} else {
					play(pls.children[0]);
				}
			}
		} else {
			if (typeof track == 'object') {

				var curTrack = pls.querySelector('.selected');
				if (curTrack) clearSelected();

				var url = track.dataset.trackUrl;

				try {
					Amplitude.playNow({
						"url": url
					});
					track.classList.add('selected');
				} catch (err) {
					console.log("Can't play " + url + ". Error: " + err.message);
					return playNext();
				}
				if (isRefreshDivs) refreshPlayDivs(track);
			} else {
				console.log('Track not found');
			}

		}
	}

	/* Play it again, Amplitude */
	function playAgain(curTrack) {
		var url = curTrack.dataset.trackUrl;
		Amplitude.playNow({
			"url": url
		});
	}

	/* 
	========
	playNext
	========

	Method to determine which track plays next:
	- In shuffle mode, plays next song in plsShuffled
	- When no track is selected yet (class '.selected'), plays the first track in playlist
	- If user wants to play again the same song (isRepeat), asks Amplitude to play it again
	- Gets the next track in playlist (nextElementSibling) and sends it to play()
	- In continuous mode, if it is the last track, starts playing again
	- In normal mode, if it is the last track, fires the event "playEnd"
	*/
	function playNext() {

		if (isPlayOne) return playStop();

		if (isShuffle) return playNextShuffled();

		var curTrack = pls.querySelector('.selected');
		if (!curTrack) return play(pls.children[0]);

		if (isRepeat) return playAgain(curTrack);

		var nextTrack = curTrack.nextElementSibling;

		if (nextTrack) {
			play(nextTrack);
		} else {
			if (isContinuous) {
				play(pls.children[0]);
			} else {
				if (Amplitude.getSongPlayedPercentage() === 100) {
					curTrack.classList.remove('selected');
					firePlayEnd();
				}
			}
		}
	}

	/* 
	================
	playNextShuffled
	================
	Method to play next track in shuffled mode. 
	When continuous mode is selected and plsShuffledIndex has finished playing plsShuffled, resets plaShuffled and starts again
	*/
	function playNextShuffled() {

		if (plsShuffledIndex < (plsShuffled.length - 1)) {
			plsShuffledIndex += 1;
			play(plsShuffled[plsShuffledIndex]);
		} else {
			if (isContinuous) {
				setPlsShuffled();
				play(plsShuffled[0]);
			} else {
				if (Amplitude.getSongPlayedPercentage() === 100) {
					curTrack.classList.remove('selected');
					firePlayEnd();
				}
			}
		}
	}

	/* Play a track by id */
	function playNow(id) {
		var t = document.getElementById(id);
		if (t) play(t);
	}

	/* play prev track*/
	function playPrev() {

		if (isShuffle) {
			playPrevShuffled();
		} else {
			var curTrack = pls.querySelector('.selected');
			var prevTrack = curTrack.previousElementSibling;
			if (prevTrack) {
				play(prevTrack);
			}
		}
	}

	/* play previous track in shuffled pls */
	function playPrevShuffled() {
		if (plsShuffledIndex > 0) {
			plsShuffledIndex -= 1;
			play(plsShuffled[plsShuffledIndex]);
		}
	}

	/* Stop playing and resets plsShuffle --if playing shuffled*/
	function playStop() {

		if (Amplitude.getSongPlayedPercentage()) {
			Amplitude.setSongPlayedPercentage(0);
			Amplitude.pause();
		}

		if (isRefreshDivs) clearDivs([options.mainArtist, options.mainSong]);

		if (isShuffle) setPlsShuffled();

	}

	/* Refresh play divs */
	function refreshPlayDivs(track) {

		var artist = track.querySelector('.artist');
		var mainArtist = document.getElementById(options.mainArtist);
		if (artist && mainArtist) mainArtist.innerHTML = artist.innerText;

		var song = track.querySelector('.song');
		var mainSong = document.getElementById(options.mainSong);
		if (song && mainSong) mainSong.innerHTML = song.innerText;

		var album = track.dataset.album;
		var mainAlbum = document.getElementById(options.mainAlbum)
		if (album && mainAlbum) mainAlbum.src = album;

	}

	/* Set continuous playback */
	function setContinuous() {
		isContinuous = !isContinuous;
	}

	/* Set play only one */
	function setPlayOne() {
		isPlayOne = !isPlayOne;
	}

	/* Set refresh divs */
	function setRefreshDivs(bol) {
		isRefreshDivs = bol;
	}

	/* Create shuffled playlist */
	function setPlsShuffled() {
		var tracks = pls.getElementsByTagName("LI");
		if (tracks.length > 0) {
			plsShuffled = Array.from(tracks);
			plsShuffled = shuffleMe(plsShuffled);
			plsShuffledIndex = 0;
		}
	}

	/* Set repeat mode */
	function setRepeat() {
		isRepeat = !isRepeat;
	}

	/* Set shuffle playback */
	function setShuffle() {
		isShuffle = !isShuffle;
		if (isShuffle) setPlsShuffled();
	}

	/* Shuffler function - Implements Knuth-Fisher-Yates shuffle algorithm */
	function shuffleMe(array) {

		var currentIndex = array.length,
			temporaryValue, randomIndex;

		while (0 !== currentIndex) {

			randomIndex = Math.floor(Math.random() * currentIndex);
			currentIndex -= 1;

			temporaryValue = array[currentIndex];
			array[currentIndex] = array[randomIndex];
			array[randomIndex] = temporaryValue;
		}

		return array;
	}

	/* Adds array with new songs to active playlist:
		Ex: tracks = [
						{
							id: 'pls100',
							url: 'demo3.mp3',
							album: 'demo3.png',
							artist: 'Miguel de la Bastide',
							song: 'Viajero'							
						},
						{
							id: 'pls101',
							url: 'demo4.mp3',
							album: 'demo4.png',
							artist: 'El viejín',
							song: 'A mi hijo J.'									
						}
					]
	*/
	function utilsAddNewTracks(tracks) {
		if (!Array.isArray(tracks)) {
			console.log("Error: tracks must be an array");
			return false;
		}

		var tracksLen = tracks.length;

		for (var i = 0; i < tracksLen; i++) {
			pls.innerHTML += utilsCreateTrack(tracks[i]);
		}
	}

	/* String literal template to create a new track */
	function utilsCreateTrack(track) {
		var track = utilsSanitizeObj(track);
		return `<li ${ (track.id && track.id.innerHTML !== '') ? `id='${track.id.innerHTML}'` : ""} data-track-url="${track.url.innerHTML}" ${ (track.album && track.album.innerHTML !== '') ? `data-album='${track.album.innerHTML}'` : ""} onclick="Apls.play(this)">
		            ${ (track.artist && track.artist.innerHTML !== '') ? `<span class="artist">${track.artist.innerHTML}</span>` : ""} ${ (track.song && track.song.innerHTML !== '') ? ` | <span class="song">${track.song.innerHTML}</span>` : ""}
				 </li>`
	}

	/* Sanitizes obj */
	function utilsSanitizeObj(obj) {
		var cleanObj = {};
		for (prop in obj) {
			var span = document.createElement("span");
			span.appendChild(document.createTextNode(obj[prop]));
			cleanObj[prop] = span;
		}
		return cleanObj;
	}


	return {
		addSong: utilsAddNewTracks,
		continuous: setContinuous,
		init: init,
		isContinuous: getContinuous,
		isPaused: getPaused,
		isPlayOne: getPlayOne,
		isRepeat: getRepeat,
		isShuffle: getShuffle,
		pause: pause,
		playlist: getPlaylist,
		play: play,
		playNext: playNext,
		playNow: playNow,
		playOne: setPlayOne,
		playPrev: playPrev,
		plsShuffled: getPlsShuffled,
		stop: playStop,
		refreshDivs: setRefreshDivs,
		repeat: setRepeat,
		shuffle: setShuffle,
		ver: getVersion,
	}
})();
