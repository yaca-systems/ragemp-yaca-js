const settings = {
    maxRadioChannels: 9,
    UNIQUE_SERVER_ID: "",
    CHANNEL_ID: 2,
    CHANNEL_PASSWORD: "",
    DEFAULT_CHANNEL_ID: 1
}

function generateRandomString(length: number = 50, possible: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789") {
    let text = "";
    for (let i = 0; i < length; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

export class YaCAServerModule {
    static instance: YaCAServerModule;
    static nameSet = new Set();
    static voiceRangesColShapes = new Map();
    static radioFrequencyMap = new Map();

    constructor() {
        console.log('~g~ --> YaCA: Server loaded');
        this.registerEvents();
    }

    static getInstance(): YaCAServerModule {
        if (!this.instance) {
            this.instance = new YaCAServerModule();
        }

        return this.instance;
    }

    registerEvents(): any {
        mp.events.add('playerQuit', this.handlePlayerDisconnect.bind(this));
        //mp.events.add('playerLeftVehicle', this.handlePlayerLeftVehicle.bind(this));
        mp.events.add('playerEnterColshape', this.handleEntityEnterColshape.bind(this));
        mp.events.add('playerExitColshape', this.handleEntityLeaveColshape.bind(this));

        mp.events.add('yacaAddPlayer', this.addNewPlayer.bind(this));
        mp.events.add('yacaWsReady', this.playerReconnect.bind(this));
        mp.events.add('yacaNoVoicePlugin', this.playerNoVoicePlugin.bind(this));
    }

    generateRandomName(
        player: PlayerMp
    ): any {
        let name; 
        for (let i = 0; i < 100; i++) {
            let generatedName = generateRandomString(15, "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789");
            if (!YaCAServerModule.nameSet.has(name)) {
                name = generatedName;
                YaCAServerModule.nameSet.add(name);
                break;
            }
        }

        if (!name) player.notify("Fehler bei der Teamspeaknamens findung, bitte reconnecte!");

        return name;
    }

    connectToVoice(player: PlayerMp) {
        const name = this.generateRandomName(player);
        if (!name) return;

        player.voiceSettings = {
            voiceRange: 3,
            voiceFirstConnect: false,
            maxVoiceRangeInMeter: 15,
            muted: false,
            ingameName: name,
        };

        player.radioSettings = {
            activated: false as boolean,
            currentChannel: 1 as number,
            hasLong: false as boolean,
            frequencies: {} as { [key: number]: string }
        };

        this.connect(player);
    }

    handlePlayerDisconnect(player: PlayerMp) {
        const playerID = player.id;
        YaCAServerModule.nameSet.delete(player.voiceSettings?.ingameName);

        const allFrequences = YaCAServerModule.radioFrequencyMap;
        for (const [key, value] of allFrequences) {
            value.delete(playerID);
            if (!value.size) YaCAServerModule.radioFrequencyMap.delete(key)
        }
    }

    /*
    handlePlayerLeftVehicle(player: PlayerMp, vehicle: VehicleMp, seat: number) {
        //YaCAServerModule.changeMegaphoneState(player, false, true);
    }*/

    handleEntityEnterColshape(colshape: ColshapeMp, entity: EntityMp) {
        if (!colshape.voiceRangeInfos || !(entity instanceof PlayerMp)) return;

        const voiceRangeInfos = colshape.voiceRangeInfos;

        //@ts-ignore
        entity.call("client:yaca:setMaxVoiceRange", voiceRangeInfos.maxRange);

        switch (voiceRangeInfos.maxRange)
        {
            case 5:
                entity.voiceSettings.maxVoiceRangeInMeter = 20;
                break;
            case 6:
                entity.voiceSettings.maxVoiceRangeInMeter = 25;
                break;
            case 7:
                entity.voiceSettings.maxVoiceRangeInMeter = 30;
                break;
            case 8:
                entity.voiceSettings.maxVoiceRangeInMeter = 40;
                break;
        }
    };

    handleEntityLeaveColshape(colshape: ColshapeMp, entity: EntityMp) {
        if (!colshape.voiceRangeInfos || !(entity instanceof PlayerMp)) return;

        entity.voiceSettings.maxVoiceRangeInMeter = 15;

        //We have to reset it here if player leaves the colshape
        if (entity.voiceSettings.voiceRange > 15) {
            //@ts-ignore
            entity.call("client:yaca:setMaxVoiceRange", 15);
            //@ts-ignore
            this.changeVoiceRange(entity, 15);
        }
    };

    playerNoVoicePlugin(player: PlayerMp) {
        if (player) player.kick("Dein Voiceplugin war nicht aktiviert!");
    }

    playerReconnect(player: PlayerMp, isFirstConnect: boolean) {
        if (!player.voiceSettings.voiceFirstConnect) return;

        if (!isFirstConnect) {
            const name = this.generateRandomName(player);
            if (!name) return;

            YaCAServerModule.nameSet.delete(player.voiceSettings?.ingameName);
            player.voiceSettings.ingameName = name;
        }

        this.connect(player);
    }

    changeVoiceRange(player: PlayerMp, range: number) {
        // Sanitycheck to prevent hackers or shit
        //@ts-ignore
        if (player.voiceSettings.maxVoiceRangeInMeter < range) return player.call("yacaSetMaxVoiceRange", 15);

        player.voiceSettings.voiceRange = range;
        //@ts-ignore
        mp.players.call("yacaVoiceRangeChanged", player.id, player.voiceSettings.voiceRange);

        if (player.voiceplugin) player.voiceplugin.range = range;
    }

    connect(player: PlayerMp) {
        player.voiceSettings.voiceFirstConnect = true;

        player.call("yacaInit", {
            //@ts-ignore
            suid: settings.UNIQUE_SERVER_ID,
            chid: settings.CHANNEL_ID,
            deChid: settings.DEFAULT_CHANNEL_ID,
            channelPassword: settings.CHANNEL_PASSWORD,
            ingameName: player.voiceSettings.ingameName,
        });
    }

    addNewPlayer(player: PlayerMp, cid: number) {
        if (!cid) return;

        player.voiceplugin = {
            cid: cid,
            muted: player.voiceSettings.muted,
            range: player.voiceSettings.voiceRange,
            playerId: player.id
        };

        //@ts-ignore
        mp.players.call("yacaAddPlayers", player.voiceplugin);

        const allPlayers = mp.players.toArray();
        let allPlayersData = [];
        for (const playerServer of allPlayers) {
            if (!playerServer.voiceplugin || playerServer.id == player.id) continue;

            allPlayersData.push(playerServer.voiceplugin);
        }

        player.call("yacaAddPlayers", allPlayersData);
    }
}