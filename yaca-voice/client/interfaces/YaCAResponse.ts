export interface IYaCAResponse {
    code: 'RENAME_CLIENT' | 'MOVE_CLIENT' | 'MUTE_STATE' | 'TALK_STATE' | 'OK' | 'WRONG_TS_SERVER' | 'NOT_CONNECTED' | 'MOVE_ERROR' | 'OUTDATED_VERSION' | 'WAIT_GAME_INIT';
    requestType: string;
    message: string;
}