import {Server, WebSocket} from "mock-socket"
import Moxios from "moxios"

import Axios from "axios"
import Vue from "vue"
import Vuex from "vuex"

import {newStreamStore, streamStoreOperations, exportsForTests} from "streams/app/stores/streamStore"
import {actions, mutations, getters} from "streams/app/stores/streamStore.operations"
import getState from "streams/app/stores/streamStore.state"


describe("streamStore", () => {
    afterEach(() => {
        Sinon.restore()
    })

    describe("newStreamStore", () => {
        context("when websocket connects", () => {
            it("should connect with protocol wss:// when browser protocol is HTTPS", () => {
                jsdom.reconfigure({url: "https://localhost"})
                window.context = {streamName: "public"}
                const mockWebSocket = Sinon.spy()
                newStreamStore({WebSocketImpl: mockWebSocket})
                mockWebSocket.getCall(0).args[0].should.equal("wss://localhost/ch/streams/public/")
            })

            it("should connect with protocol ws:// when browser protocol is HTTP", () => {
                jsdom.reconfigure({url: "http://localhost"})
                window.context = {streamName: "public"}
                const mockWebSocket = Sinon.spy()
                newStreamStore({WebSocketImpl: mockWebSocket})
                mockWebSocket.getCall(0).args[0].should.equal("ws://localhost/ch/streams/public/")
            })
        })

        context("when websocket receives a message", () => {
            it("should dispatch receivedNewContent to store when serveur sends a next message", (done) => {
                let mockserver = new Server("wss://localhost:8080/ch/streams/public/")
                jsdom.reconfigure({url: "https://localhost:8080"})
                window.context = {streamName: "public"}
                Sinon.spy(Vuex.Store.prototype, "dispatch")
                mockserver.on("connection", () => mockserver.send(JSON.stringify({event: "new", id: 4})))
                newStreamStore({WebSocketImpl: WebSocket})
                setTimeout(() => {
                    Vuex.Store.prototype.dispatch.getCall(0).args
                        .should.eql([streamStoreOperations.receivedNewContent, 1])
                    done()
                }, 200)
            })
        })

        context("when initializing the store", () => {
            it("should call Vuex.Store with correct parameters when no option is passed", () => {
                Sinon.spy(Vuex, "Store")
                newStreamStore()
                // Comparison by string. What matters is that the argument has the correct structure
                JSON.stringify(Vuex.Store.getCall(0).args[0])
                    .should.eql(JSON.stringify(exportsForTests.getStructure(getState(), {})))
            })

            it("should not attach the websocket implementation to the store", () => {
                Sinon.spy(Vuex, "Store")
                newStreamStore({WebSocketImpl: Sinon.stub().returns({})})
                JSON.stringify(Vuex.Store.getCall(0).args[0])
                    .should.eql(JSON.stringify(exportsForTests.getStructure(getState(), {})))
            })

            it("should attach any other option to the store", () => {
                Sinon.spy(Vuex, "Store")
                let modules = {modules: {applicationStore: {}}}
                newStreamStore(modules)
                Vuex.Store.getCall(0).args[0].modules.should.eq(modules.modules)
            })

            it("should return the result of `new Vuex.Store`", () => {
                let result = {}
                Sinon.stub(Vuex, "Store").returns(result)
                newStreamStore().should.eq(result)
            })

            it("should attach the websocket instance to the store", () => {
                let ws = {}
                Sinon.stub(Vuex, "Store").returns({})
                let WebSocketImpl = Sinon.stub()
                WebSocketImpl.returns(ws)
                newStreamStore({WebSocketImpl}).$websocket.should.eq(ws)
            })
        })
    })

    describe("onSuccess", () => {
        it("should append payload to state", () => {
            let payload = {
                data: [
                    {id: "6", text: "foobar"},
                    {id: "7", text: "blablabla"},
                ],
            }

            let state = {
                contentIds: ["1", "2"],
                contents: {
                    "1": {id: "1", text: "Plop"},
                    "2": {id: "2", text: "Hello!"},
                },
            }

            exportsForTests.onSuccess(state, payload)

            state.should.eql({
                contentIds: ["1", "2", "6", "7"],
                contents: {
                    "1": {id: "1", text: "Plop"},
                    "2": {id: "2", text: "Hello!"},
                    "6": {id: "6", text: "foobar"},
                    "7": {id: "7", text: "blablabla"},
                },
            })
        })
    })

    describe("onError", () => {
        it("should log an error", () => {
            Sinon.spy(console, "error")
            exportsForTests.onError({}, "unknown error")
            console.error.getCall(0).args[0].should.eq("An error happened while fetching post: unknown error")
        })
    })

    describe("newRestAPI", () => {
        beforeEach(() => {
            Vue.prototype.$http = Axios.create({
                xsrfCookieName: "csrftoken",
                xsrfHeaderName: "X-CSRFToken",
            })
            Moxios.install(Vue.prototype.$http)
        })

        afterEach(() => {
            Moxios.uninstall()
        })

        context("when requesting public stream", () => {
            it("should handle public stream request", (done) => {
                let state = getState()
                let onError = Sinon.spy()
                let onSuccess = Sinon.spy()
                let response = {
                    status: 200,
                    response: [
                        {id: "6", text: "foobar"},
                        {id: "7", text: "blablabla"},
                    ],
                }
                let target = new Vuex.Store(exportsForTests.newRestAPI({state, onError, onSuccess}))

                Moxios.stubRequest("/api/streams/public/", response)

                target.dispatch(streamStoreOperations.getPublicStream)

                Moxios.wait(() => {
                    onSuccess.getCall(0).args[1].data.should.eql(response.response)
                    done()
                })
            })

            it("should handle public stream request error", (done) => {
                let state = getState()
                let onError = Sinon.spy()
                let onSuccess = Sinon.spy()
                let target = new Vuex.Store(exportsForTests.newRestAPI({state, onError, onSuccess}))

                Moxios.stubRequest("/api/streams/public/", {status: 500})

                target.dispatch(streamStoreOperations.getPublicStream)

                Moxios.wait(() => {
                    onError.called.should.be.true
                    target.state.error.contents.should.exist
                    done()
                })
            })
        })

        context("when requesting followed stream", () => {
            it("should handle followed stream request", (done) => {
                let state = getState()
                let onError = Sinon.spy()
                let onSuccess = Sinon.spy()
                let response = {
                    status: 200,
                    response: {
                        data: [
                            {id: "6", text: "foobar"},
                            {id: "7", text: "blablabla"},
                        ],
                    },
                }
                let target = new Vuex.Store(exportsForTests.newRestAPI({state, onError, onSuccess}))

                Moxios.stubRequest("/api/streams/followed/", response)

                target.dispatch(streamStoreOperations.getFollowedStream)

                Moxios.wait(() => {
                    onSuccess.getCall(0).args[1].data.should.eql(response.response)
                    done()
                })
            })

            it("should handle followed stream request error", (done) => {
                let state = getState()
                let onError = Sinon.spy()
                let onSuccess = Sinon.spy()
                let target = new Vuex.Store(exportsForTests.newRestAPI({state, onError, onSuccess}))

                Moxios.stubRequest("/api/streams/followed/", {status: 500})

                target.dispatch(streamStoreOperations.getFollowedStream)

                Moxios.wait(() => {
                    onError.calledOnce.should.be.true
                    target.state.error.contents.should.exist
                    done()
                })
            })
        })

        context("when requesting tag stream", () => {
            it("should handle tag stream request", (done) => {
                let state = getState()
                let onError = Sinon.spy()
                let onSuccess = Sinon.spy()
                let response = {
                    status: 200,
                    response: [
                        {id: "6", text: "foobar"},
                        {id: "7", text: "blablabla"},
                    ],
                }
                let target = new Vuex.Store(exportsForTests.newRestAPI({state, onError, onSuccess}))

                Moxios.stubRequest("/api/streams/tag/#yolo/", response)

                target.dispatch(streamStoreOperations.getTagStream, {params: {name: "#yolo"}})

                Moxios.wait(() => {
                    onSuccess.getCall(0).args[1].data.should.eql(response.response)
                    done()
                })
            })

            it("should handle tag stream request error", (done) => {
                let state = getState()
                let onError = Sinon.spy()
                let onSuccess = Sinon.spy()
                let target = new Vuex.Store(exportsForTests.newRestAPI({state, onError, onSuccess}))

                Moxios.stubRequest("/api/streams/tag/#yolo/", {status: 500})

                target.dispatch(streamStoreOperations.getTagStream, {params: {name: "#yolo"}})

                Moxios.wait(() => {
                    onError.calledOnce.should.be.true
                    target.state.error.contents.should.exist
                    done()
                })
            })
        })

        // Do not execute these tests as the feature does not exists yet
        context.skip("when requesting profile stream", () => {
            it("should handle profile stream request", () => {
                let state = getState()
                let onError = Sinon.spy()
                let onSuccess = Sinon.spy()
                let response = {
                    status: 200,
                    response: [
                        {id: "6", text: "foobar"},
                        {id: "7", text: "blablabla"},
                    ],
                }
                let target = new Vuex.Store(exportsForTests.newRestAPI({state, onError, onSuccess}))

                Moxios.stubRequest("", response)

                target.dispatch(streamStoreOperations.getPublicStream)

                Moxios.wait(() => {
                    onSuccess.getCall(0).args[0].should.eql(response)
                })
            })

            it("should handle profile stream request error", () => {
                let state = getState()
                let onError = Sinon.spy()
                let onSuccess = Sinon.spy()
                let target = new Vuex.Store(exportsForTests.newRestAPI({state, onError, onSuccess}))

                Moxios.stubRequest("", {status: 500})

                target.dispatch(streamStoreOperations.getPublicStream)

                Moxios.wait(() => {
                    onError.calledOnce(0).should.be.true
                    target.state.error.contents.should.exist
                })
            })
        })

    })

    describe("getStructure", () => {
        it("should have actions, mutations and getters defined", () => {
            let target = exportsForTests.getStructure(getState(), {modules: {applicationStore: {}}})

            target.actions[streamStoreOperations.getFollowedStream].should.exist
            target.actions[streamStoreOperations.getProfileStream].should.exist
            target.actions[streamStoreOperations.getPublicStream].should.exist
            target.actions[streamStoreOperations.getTagStream].should.exist
            target.actions[streamStoreOperations.newContentAck].should.exist
            target.actions[streamStoreOperations.receivedNewContent].should.exist

            target.mutations[streamStoreOperations.newContentAck].should.exist
            target.mutations[streamStoreOperations.receivedNewContent].should.exist

            target.getters.contentList.should.exist

            target.modules.applicationStore.should.exist
        })
    })

    describe("mutations", () => {
        describe("receivedNewContent", () => {
            it("should set state.stream.hasNewContent to true", () => {
                let state = {hasNewContent: false, newContentLengh: 0, contents: {}, contentIds: []}
                mutations[streamStoreOperations.receivedNewContent](state, 42)
                state.hasNewContent.should.be.true
            })

            it("should increment state.stream.newContentLengh by 1", () => {
                let state = {hasNewContent: false, newContentLengh: 0, contents: {}, contentIds: []}
                mutations[streamStoreOperations.receivedNewContent](state, 42)
                state.newContentLengh.should.equal(1)
            })

            it("should add the new post id to the content list with undefined value", () => {
                let state = {hasNewContent: false, newContentLengh: 0, contents: {}, contentIds: []}
                mutations[streamStoreOperations.receivedNewContent](state, 42)
                state.contentIds.should.eql([42])
                state.contents.should.eql({42: undefined})
            })
        })
        describe("newContentAck", () => {
            it("should set state.stream.hasNewContent to true", () => {
                let state = {hasNewContent: true, newContentLengh: 0}
                mutations[streamStoreOperations.newContentAck](state)
                state.hasNewContent.should.be.false
            })

            it("should set state.stream.newContentLengh to 0", () => {
                let state = {hasNewContent: true, newContentLengh: 10}
                mutations[streamStoreOperations.newContentAck](state)
                state.newContentLengh.should.equal(0)
            })
        })
    })

    describe("actions", () => {
        describe("receivedNewContent", () => {
            it("should commit with the correct parameters", () => {
                let commit = Sinon.spy()
                actions[streamStoreOperations.receivedNewContent]({commit}, 10)
                commit.getCall(0).args.should.eql([streamStoreOperations.receivedNewContent, 10])
            })
        })
        describe("newContentAck", () => {
            it("should commit with the correct parameters", () => {
                let commit = Sinon.spy()
                actions[streamStoreOperations.newContentAck]({commit})
                commit.getCall(0).args[0].should.equal(streamStoreOperations.newContentAck)
            })
        })
    })

    describe("getters", () => {
        describe("contentList", () => {
            it("should only return existing posts", () => {
                let state = {
                    contentIds: ["1", "2", "3", "4", "5"],
                    contents: {
                        "1": {id: "1"},
                        "3": {id: "3"},
                        "5": {id: "5"},
                    },
                }
                getters.contentList(state).should.eql([{id: "1"}, {id: "3"}, {id: "5"}])
            })
        })
    })
})
