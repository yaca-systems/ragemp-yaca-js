import { YaCAStereoModeEnum } from './enums/YaCAStereoMode.js';
import { YaCAFilterEnum } from './enums/YaCAFilter.js';
import { IYaCAResponse } from './interfaces/YaCAResponse.js';

const settings = {
    maxRadioChannels: 9,
    maxPhoneSpeakerRange: 5
}

const lipsyncAnims = {
    true: {
        name: 'mic_chatter',
        dict: 'mp_facial'
    },
    false: {
        name: 'mood_normal_1',
        dict: 'facials@gen_male@variations@normal'
    }
}

const defaultRadioChannelSettings = {
    volume: 1,
    stereo: YaCAStereoModeEnum.STEREO,
    muted: false,
    frequency: 0
}

const voiceRangesEnum = {
    1: 1,
    2: 3,
    3: 8,
    4: 15,
    5: 20,
    6: 25,
    7: 30,
    8: 40
}

const translations = {
    'plugin_not_activated': 'Please activate your voiceplugin!',
    'connect_error': 'Error while connecting to voiceserver, please reconnect!',
    'plugin_not_initializiaed': 'Plugin not initialized!',
    'OUTDATED_VERSION': 'You dont use the required plugin version!',
    'WRONG_TS_SERVER': 'You are on the wrong teamspeakserver!',
    'NOT_CONNECTED': 'You are on the wrong teamspeakserver!',
    'MOVE_ERROR': 'Error while moving into ingame teamspeak channel!',
    'WAIT_GAME_INIT': ''
}

class YaCAClientModule {
    static instance: null | YaCAClientModule = null;

    localPlayer: PlayerMp = mp.players.local;
    rangeInterval: number | null = null;
    monitorInterval: number | null = null;
    websocket: WebSocket | null = null;
    noPluginActivated: number = 0;
    messageDisplayed: boolean = false;
    visualVoiceRangeTimout: number | null = null;
    visualVoiceRangeTick: number | null = null;
    uirange: number = 2;
    lastuirange: number = 2;
    isTalking: boolean = false;
    firstConnect: boolean = true;
    isPlayerMuted: boolean = false;
    radioFrequenceSetted: boolean = false;
    radioToggle: boolean = false;
    radioEnabled: boolean = false;
    radioTalking: boolean = false;
    radioChannelSettins: any = {};
    radioInited: boolean = false;
    activeRadioChannel: number = 1;
    playersWithShortRange: Map<number, string> = new Map();
    playersInRadioChannel: Map<number, Set<number>> = new Map();

    constructor() {
        this.localPlayer.yacaPluginLocal = {
            canChangeVoiceRange: true,
            maxVoiceRange: 4,
            lastMegaphoneState: false,
            canUseMegaphone: false
        }
        this.registerEvents();
    }

    /**
     * To register the events
     */
    registerEvents(): any {
        mp.events.add('yacaInit', (dataObj) => {
            if (this.rangeInterval) {
                clearInterval(this.rangeInterval);
                this.rangeInterval= null;
            }

            if (!this.websocket) {
                this.websocket = new WebSocket('ws://127.0.0.1:30125');
                this.websocket.onmessage = (msg: any) => {
                    this.handleResponse(msg);
                }
                this.websocket.onerror = (reason) => {
                    mp.console.logError('Error: ' + reason);
                }
                this.websocket.onclose = (reason: any) => {
                    mp.console.logError('Disconnected: ' +reason);
                }
                this.websocket.onopen = () => {
                    if (this.firstConnect) {
                        this.initRequest(dataObj);
                        this.firstConnect = false;
                    } else {
                        mp.events.callRemote('yacaWsReady', this.firstConnect);
                    }

                    mp.console.logInfo('--> Websocket Connected...');
                }

                //@ts-ignore
                this.monitorInterval = setInterval(this.monitorConnectstate.bind(this), 1000);
            }

            if (this.firstConnect) return;

            this.initRequest(dataObj);
        });

        mp.events.add('yacaAddPlayers', (dataObjects) => {
            if (!Array.isArray(dataObjects)) dataObjects = [dataObjects];
            for (const dataObj of dataObjects) {
                if (!dataObj || typeof dataObj.range == "undefined" || typeof dataObj.cid == "undefined" || typeof dataObj.playerId == "undefined") continue;

                const player = mp.players.atRemoteId(dataObj.playerId);

                player.yacaPlugin = {
                    radioEnabled: player.yacaPlugin?.radioEnabled || false,
                    cid: dataObj.cid,
                    muted: dataObj.muted,
                    range: dataObj.range,
                    isTalking: false,
                    phoneCallMemberIds: player.yacaPlugin?.phoneCallMemberIds || undefined,
                }
            }
        });

        mp.events.add('yacaMuteTarget', (
            target: number,
            muted: boolean
        ) => {
            const player = mp.players.atRemoteId(target);

            if (player.yacaPlugin) player.yacaPlugin.muted = muted;
        });
    }

    /**
     * Gets the singleton of YaCAClientModule
     * @returns {YaCAClientModule}
     */
    static getInstance(): YaCAClientModule {
        if (!this.instance) {
            this.instance = new YaCAClientModule();
        }

        return this.instance;
    }

    clamp(
        value: number,
        min: number = 0,
        max: number = 1
    ): any {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Calculates the distance between players
     * @param pos1 
     * @param pos2 
     * @returns {number}
     */
    getDistanceBetween(
        pos1: Vector3Mp,
        pos2: Vector3Mp
    ): any {
        return Math.sqrt(
            (pos1.x - pos2.x) * (pos1.x - pos2.x) +
			(pos1.y - pos2.y) * (pos1.y - pos2.y) +
			(pos1.z - pos2.z) * (pos1.z - pos2.z)
        )
    }

    /**
     * Gets players in range
     * @param distance 
     * @param pos 
     * @returns {Array}
     */
    getAllPlayersInStreamingRange(
        distance = 4,
        pos = mp.players.local.position
    ): any {
        let inRange = [];
        const streamedIn = mp.players.streamed;

        for(const player of streamedIn) {
            const distanceTo = this.getDistanceBetween(player.position, pos);

            if (distanceTo > distance) continue;

            inRange.push({
                player: player,
                distance: distance
            });
        }

        return inRange;
    }

    /**
     * Gets the camera direction
     * @returns {rotVector}
     */
    getCamDirection(): any {
        const rotVector = mp.game.cam.getGameplayCamRot(0);
        const num = rotVector.z * 0.0174532924;
        const num2 = rotVector.x * 0.0174532924;
        const num3 = Math.abs(Math.cos(num2));

        return new rotVector(
            -Math.sin(num) * num3,
            Math.cos(num) * num3,
            this.localPlayer.getForwardVector().z
        );
    }

    /**
     * Sets the player variable
     * @param player 
     * @param variable 
     * @param value 
     */
    setPlayerVariable(
        player: PlayerMp,
        variable: string,
        value: any
    ): any {
        if (!player.yacaPlugin) player.yacaPlugin;
        //@ts-ignore
        player.yacaPlugin[variable] = value;
    }

    changeVoiceRange(
        toggle: number
    ): any {
        if (!this.localPlayer.yacaPluginLocal.canChangeVoiceRange) return false;
        if (this.visualVoiceRangeTimout) {
            clearTimeout(this.visualVoiceRangeTimout);
            this.visualVoiceRangeTimout = null;
        }
        this.uirange += toggle;

        if (this.uirange < 1) {
            this.uirange = 1;
        } else if (this.uirange == 5 && this.localPlayer.yacaPluginLocal.maxVoiceRange < 5) {
            this.uirange = 4;
        } else if (this.uirange == 6 && this.localPlayer.yacaPluginLocal.maxVoiceRange < 6) {
            this.uirange = 5;
        } else if (this.uirange == 7 && this.localPlayer.yacaPluginLocal.maxVoiceRange < 7) {
            this.uirange = 6;
        } else if (this.uirange == 8 && this.localPlayer.yacaPluginLocal.maxVoiceRange < 8) {
            this.uirange = 7;
        } else if (this.uirange > 8) {
            this.uirange = 8;
        }

        if (this.lastuirange == this.uirange) return false;
        this.lastuirange = this.uirange;

        //@ts-ignore
        const voiceRange = voiceRangesEnum[this.uirange] || 1;

        //@ts-ignore
        this.visualVoiceRangeTimout = setTimeout(() => {
            this.visualVoiceRangeTimout = null;
        }, 1000);

        mp.events.callRemote('yacaVoiceRangeChanged', voiceRange);

        return true;
    }

    isComTypeValid(
        type: YaCAFilterEnum
    ): any {
        const valid = YaCAFilterEnum[type];

        if (!valid) mp.console.logError('Invalid com type: ' + type);

        return !!valid;
    }

    sendWebsocket(
        msg: {}
    ): any {
        if (!this.websocket) return mp.console.logError('Websocket failed!');
        if (this.websocket.readyState == 1) this.websocket.send(JSON.stringify(msg));
    }

    initRequest(
        dataObj: any
    ): any {
        if (!dataObj || !dataObj.suid || typeof dataObj.child != 'number' || !dataObj.deChid || !dataObj.ingameName || !dataObj.channelPassword) return mp.console.logError('Connect error!');

        this.sendWebsocket({
            base: {
                'request_type': 'INIT'
            },
            server_guid: dataObj.suid,
            ingame_name: dataObj.ingameName,
            ingame_channel: dataObj.chid,
            default_channel: dataObj.deChid,
            ingame_channel_password: dataObj.channelPassword,
            exluded_channels: [
                1337
            ],
            muffling_range: 2
        });
    }

    isPluginInitialized(): any {
        const inited = !!mp.players.local.yacaPlugin;

        if (!inited) mp.console.logError('Initialzation error!');

        return inited;
    }

    handleResponse(
        payload: IYaCAResponse
    ): any {
        if (!payload) return;

        try {
            //@ts-ignore
            payload = JSON.parse(payload);
        } catch(e) {
            
            mp.console.logError('Parsing error: ' + e);
            return;
        }

        if (payload.code == 'OK') {
            if (payload.requestType === 'JOIN') {
                mp.events.callRemote('yacaAddPlayer', parseInt(payload.message));

                if (this.rangeInterval) {
                    clearInterval(this.rangeInterval);
                    this.rangeInterval = null;
                }
//@ts-ignore
                this.rangeInterval = setInterval(this.calcPlayers.bind(this), 250);
//@ts-ignore
                if (this.radioInited) this.initRadioSettings();
                return;
            }
        }

        if (payload.code == 'TALK_STATE' || payload.code == 'MUTE_STATE') {
            this.handleTalkState(payload);
            return;
        }
    }

    syncLipsPlayer(
        player: PlayerMp,
        isTalking: boolean
    ): any {
        //@ts-ignore
        const animationData = lipsyncAnims[isTalking];

        player.playFacialAnim(animationData.name, animationData.dict);

        if (player.yacaPlugin) player.yacaPlugin.isTalking = isTalking;
    }

    monitorConnectstate(): any {
        if (this.websocket?.readyState == 0 || this.websocket?.readyState == 1) {
            if (this.messageDisplayed && this.websocket.readyState == 1) {
                this.messageDisplayed = false;
                this.noPluginActivated = 0;
            }
            return;
        }

        this.noPluginActivated++;

        if (!this.messageDisplayed) {
            this.messageDisplayed = true;
        }

        if (this.noPluginActivated >= 120) mp.events.callRemote('yacaNoVoicePlugin');
    }

    handleTalkState(
        payload: IYaCAResponse
    ): any {
        const isTalking = !!parseInt(payload.message);

        if (payload.code == 'MUTE_STATE') {
            this.isPlayerMuted = !!parseInt(payload.message);
        }

        if (this.isTalking != isTalking) {
            this.isTalking = isTalking;

            if (payload.code !== 'MUTE_STATE') return;
//@ts-ignore
            const playerIdsNear = this.getAllPlayersInStreamingRange(40).map(p => p.player.remoteId);

            this.syncLipsPlayer(this.localPlayer, isTalking);

            if (playerIdsNear.length) mp.events.callRemote('yacaLipSync', isTalking, playerIdsNear);
        }
    }

    calcPlayers(): any {
        const players: any = [];
        const allPlayers = mp.players.streamed;
        const localPos = this.localPlayer.position;

        for(const player of allPlayers) {
            if (player.remoteId == this.localPlayer.remoteId) continue;

            const voiceSetting = player.yacaPlugin;

            if (!voiceSetting?.cid || voiceSetting.muted) continue;

            players.push({
                client_id: voiceSetting.cid,
                position: player.position,
                direction: player.getForwardVector(),
                range: voiceSetting.range,
                room: mp.game.interior.getRoomKeyFromEntity(this.localPlayer.id),
                is_underwater: player.isSwimmingUnderWater(),
                intersect: player.hasClearLosTo(this.localPlayer.id, 17)
            });

            if (voiceSetting.phoneCallMemberIds) {
                let applyPhoneSpeaker: Set<PlayerMp> = new Set();
                let phoneSpeakerRemove: Set<PlayerMp> = new Set();

                this.sendWebsocket({
                    base: {
                        'request_type': 'INGAME'
                    },
                    player: {
                        player_direction: this.getCamDirection(),
                        player_position: localPos,
                        player_room: mp.game.interior.getRoomKeyFromEntity(this.localPlayer.id),
                        player_is_underwater: player.isSwimmingUnderWater(),
                        player_list: players
                    }
                });
            }
        }
    }
}