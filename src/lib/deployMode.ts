/** 静的版（サーバーなしで公開する `app-static/`）かどうか。楽天の実データは使えない。 */
export const IS_STATIC_BUILD = import.meta.env.VITE_DEPLOY_MODE === 'static';
