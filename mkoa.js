module.exports = class Application extends Emitter{
    constructor(){
        super();
        //定义下面的属性
        this.proxy = false;
        this.middleware =[];
        this.subdomainOffset = 2;
        this.env = process.env.NODE_ENV ||'development';
        this.context = Object.create(context);
        this.request = Object.create(request);
        this.response = Object.create(response);
    }
    // listen端口方法
    listen(...args){
        const server = http.createServer(this.callback());
        return server.listen(...args);
    }
    toJSON(){
        return only(this,[
            'subdomainOffset',
            'proxy',
            'env'
        ])
    }
}