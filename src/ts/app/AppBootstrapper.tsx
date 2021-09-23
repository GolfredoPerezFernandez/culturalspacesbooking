/**
* AppBootstrapper.tsx
* Copyright: Microsoft 2018
*
* Main entry point for the app, common to both native and web.
*/

import { DbProvider } from 'nosqlprovider';
import * as RX from 'reactxp';
import * as SyncTasks from 'synctasks';

import NavContextStore from '../stores/NavContextStore';
import PageUrlService from '../services/PageUrlService';
import ResponsiveWidthStore from '../stores/ResponsiveWidthStore';
import RootView from '../views/RootView';
import ServiceManager, { Service } from '../services/ServiceManager';
import ServiceRegistrar from '../services/ServiceRegistrar';
import TodosStore from '../stores/TodosStore';

import LocalDb from './LocalDb';
import DeepLinkConverter from './DeepLinkConverter';
import AppConfig from './AppConfig';
import CurrentUserStore from '../stores/CurrentUserStore';


import { Chat } from '../models/IdentityModels';
const Moralis = require('moralis');
Moralis.initialize("gusFz0f11qYPoyrwXeIBr8OnIwOgkNZxiF8W83KJ");
Moralis.serverURL = 'https://y8zeuawsmxmx.usemoralis.com:2053/server'
import getUserLocale from 'get-user-locale';

interface Item {
    id: string;
    description: string;
    name: string;
    owner: string;
    ownerEmail: string;
    uri: string;
    forSale: boolean;
    ownerId: number;
    price: number;
    type: string;
}

export default abstract class AppBootstrapper {
    constructor() {
        RX.App.initialize(__DEV__, __DEV__);

        ServiceRegistrar.init();

        // Open the DB and startup any critical services before displaying the UI.
        LocalDb.open(this._getDbProvidersToTry()).then(() => this._startCriticalServices()).then(() => {
            RX.UserInterface.setMainView(this._renderRootView());
            const userLocale = getUserLocale();

            if (userLocale.includes('en')) {
                CurrentUserStore.setLenguage('en')
            } else if (userLocale.includes("es")) {
                CurrentUserStore.setLenguage('es')
            } else if (userLocale.includes("fr")) {
                CurrentUserStore.setLenguage('fr')
            }
            // Convert the initial URL into a navigation context.
            this._getInitialUrl().then(url => {
                if (url) {
                    const context = DeepLinkConverter.getContextFromUrl(url, NavContextStore.isUsingStackNav());
                    if (context) {
                        NavContextStore.setNavContext(context);
                    }
                }
            });
        });
    }

    private _startCriticalServices(): SyncTasks.Promise<void> {
        const servicesToStart: Service[] = [TodosStore];
        let user = Moralis.User.current()
        if (user) {
            let username = user.get('username')
            let email = user.get('email')
            let createdAt = user.get('createdAt')
            let sessionToken = user.get('sessionToken')
            let updatedAt = user.get('updatedAt')
            let photo = user.get('photo')
            let csbBalance = user.get('csbBalance')
            let objId = user.get('userId')

            CurrentUserStore.setConnect(true)
            CurrentUserStore.setLogin(true)
            this.loadUserItems(username)
            this.loadtems()
            this.subscriptionChat()
            this.loadChats(username)

            this.subscriptionItem()
            CurrentUserStore.setUser(username, email, createdAt, sessionToken, updatedAt, photo, csbBalance, objId)
        } else {

            CurrentUserStore.setConnect(false)
            CurrentUserStore.setLogin(false)
            CurrentUserStore.setUser('', '', '', '', '', '', 0, 0)
        }




        if (AppConfig.getPlatformType() === 'web') {
            servicesToStart.push(PageUrlService);
        }

        return ServiceManager.ensureStarted(servicesToStart);
    }

    private _renderRootView() {
        return (
            <RootView
                onLayout={this._onLayoutRootView}
            />


        );
    }
    loadChats = async (username: string) => {

        const chats = await Moralis.Cloud.run('getAllChatsForUser', { username })
        CurrentUserStore.setChats(chats)

    }
    loadtems = async () => {

        const ownedItems = await Moralis.Cloud.run('getAllItems')
        CurrentUserStore.setAllItems(ownedItems)
    }

    async onChatCreated2(item: any) {
        var userId1 = CurrentUserStore.getUser()
        var newChat: Chat = {
            id: item.id,
            sender: item.attributes.sender,
            receiver: item.attributes.receiver,
            messages: item.attributes.messages,
            senderId: item.attributes.senderId,
            receiverId: item.attributes.receiverId,

        }
        if (userId1.username == item.attributes.receiver || userId1.username == item.attributes.sender) {

            var count = newChat.messages.length

            CurrentUserStore.setChats([], newChat)
            CurrentUserStore.setMensajes([], newChat.messages[count - 1])
        }

    }

    async onChatCreated(item: any) {
        // var userId1 = CurrentUserStore.getUser()
        var newChat: Chat = {
            id: item.id,
            sender: item.attributes.sender,
            receiver: item.attributes.receiver,
            messages: item.attributes.messages,
            senderId: item.attributes.senderId,
            receiverId: item.attributes.receiverId,

        }
        var count = newChat.messages.length
        if ((newChat.receiverId === CurrentUserStore.getAutores()[1].id && newChat.senderId === CurrentUserStore.getAutores()[0].id) || (newChat.receiverId === CurrentUserStore.getAutores()[0].id && newChat.senderId === CurrentUserStore.getAutores()[1].id)) {

            CurrentUserStore.setMensajes([], newChat.messages[count - 1])
        }


    }
    async subscriptionChat() {
        const query = new Moralis.Query('Chat');
        let subscription = await query.subscribe()
        subscription.on('create', this.onChatCreated2)
        subscription.on('update', this.onChatCreated)
    }


    onItemCreated = async (item: any) => {

        var newItem: Item = {
            id: item.id,
            description: item.attributes.description,
            name: item.attributes.name,
            owner: item.attributes.owner,
            ownerEmail: item.attributes.ownerEmail,
            uri: item.attributes.uri,
            price: item.attributes.price,
            type: item.attributes.type,
            forSale: item.attributes.forSale,
            ownerId: item.attributes.ownerId,
        }

        let user = Moralis.User.current()
        if (item.attributes.forSale === true) {

            CurrentUserStore.setAllItems([], newItem);
            if (user.get('username') === newItem.owner) {

                CurrentUserStore.setUserItems([], newItem);
            }
        } else {
            if (user.get('username') === newItem.owner) {

                CurrentUserStore.setUserItems([], newItem);
            }
        }

    }

    subscriptionItem = async () => {
        const query = new Moralis.Query('Item');
        let subscription = await query.subscribe()
        subscription.on('create', this.onItemCreated)

    }
    loadUserItems = async (username: string) => {

        const params = { owner: username };
        const ownedItems = await Moralis.Cloud.run('getUserItems', params)
        CurrentUserStore.setUserItems(ownedItems)

    }

    private _onLayoutRootView = (e: RX.Types.ViewOnLayoutEvent) => {
        const { width, height } = e;


        if (width <= 1180) {
            CurrentUserStore.setSideMenu(false)

        }
        ResponsiveWidthStore.putWindowSize(width, height);
    };

    // Subclasses must override.
    protected abstract _getDbProvidersToTry(): DbProvider[];
    protected abstract _getInitialUrl(): SyncTasks.Promise<string | undefined>;
}
