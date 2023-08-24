declare global {
    interface PlayerMp {
        voiceSettings: {
            voiceRange: number;
            voiceFirstConnect: boolean;
            maxVoiceRangeInMeter: number;
            muted: boolean;
            ingameName: string;
        };
        voiceplugin: {
            cid: number;
            muted: boolean;
            range: number;
            playerId: number
        }
        radioSettings: {
            activated: boolean;
            currentChannel: number;
            hasLong: boolean;
            frequencies: { [key: number]: string };
        };
    }
    interface ColshapeMp {
        voiceRangeInfos: {
            maxRange: number;
        };
    }
}

export {};