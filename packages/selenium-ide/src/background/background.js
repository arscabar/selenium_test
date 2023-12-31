/*
 * Copyright 2017 SideeX committers
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

import browser from 'webextension-polyfill'
import { isStaging } from '../common/utils'
import LocatorBuilders from '../content/locatorBuilders'
export const locatorBuilders = new LocatorBuilders(window)

const hostName = "com.google.chrome.example.echo"
let nativePort
let ideWindowId = undefined
let master = {}
let clickEnabled = true

window.master = master
window.openedWindowIds = []

if (isStaging) openPanel({ windowId: 0 })

function openPanel(tab) {
  let contentWindowId = tab.windowId
  if (ideWindowId) {
    browser.windows
      .update(ideWindowId, {
        focused: true,
      })
      .catch(function() {
        ideWindowId == undefined
        openPanel(tab)
      })
    return
  } else if (!clickEnabled) {
    return
  }

  clickEnabled = false
  setTimeout(function() {
    clickEnabled = true
  }, 1500)

  return openWindowFromStorageResolution()
    .then(function waitForPanelLoaded(panelWindowInfo) {
      return new Promise(function(resolve, reject) {
        let count = 0
        let interval = setInterval(function() {
          if (count > 100) {
            reject('SideeX editor has no response')
            clearInterval(interval)
          }

          browser.tabs
            .query({
              active: true,
              windowId: panelWindowInfo.id,
              status: 'complete',
            })
            .then(function(tabs) {
              if (tabs.length != 1) {
                count++
                return
              } else {
                master[contentWindowId] = panelWindowInfo.id
                resolve(panelWindowInfo)
                clearInterval(interval)
              }
            })
        }, 200)
      })
    })
    .then(function bridge(panelWindowInfo) {
      ideWindowId = panelWindowInfo.id
      return browser.tabs.sendMessage(panelWindowInfo.tabs[0].id, {
        selfWindowId: panelWindowInfo.id,
        commWindowId: contentWindowId,
      })
    })
    .catch(function(e) {
      console.log(e) // eslint-disable-line no-console
    })
}

function openWindowFromStorageResolution() {
  let opts = {
    height: 690,
    width: 550,
  }
  return browser.storage.local
    .get()
    .then(storage => {
      if (sizeIsValid(storage.size)) {
        opts.height = storage.size.height
        opts.width = storage.size.width
      }
      if (originIsValid(storage.origin)) {
        opts.top = storage.origin.top
        opts.left = storage.origin.left
      }
      return browser.windows.create(
        Object.assign(
          {
            url: browser.extension.getURL('index.html'),
            type: 'popup',
          },
          opts
        )
      )
    })
    .catch(e => {
      console.error(e) // eslint-disable-line no-console
      return browser.windows.create(
        Object.assign(
          {
            url: browser.extension.getURL('index.html'),
            type: 'popup',
          },
          opts
        )
      )
    })
}

browser.runtime.onStartup.addListener(function() {
  browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    if (tabs && tabs.length > 0) {
      openPanel(tabs[0])
    }
  })
})

function sizeIsValid(size) {
  return size && sideIsValid(size.height) && sideIsValid(size.width)
}

function sideIsValid(number) {
  return number && number.constructor.name === 'Number' && number > 50
}

function originIsValid(origin) {
  return origin && pointIsValid(origin.top) && pointIsValid(origin.left)
}

function pointIsValid(point) {
  return point >= 0 && point.constructor.name === 'Number'
}

browser.browserAction.onClicked.addListener(openPanel)

browser.windows.onRemoved.addListener(function(windowId) {
  let keys = Object.keys(master)
  for (let key of keys) {
    if (master[key] === windowId) {
      delete master[key]
      if (keys.length === 1) {
        browser.contextMenus.removeAll()
      }
    }
  }
  if (windowId === ideWindowId) {
    ideWindowId = undefined
    Promise.all(
      window.openedWindowIds.map(windowId =>
        browser.windows.remove(windowId).catch(() => {
          /* Window was removed previously by the user */
        })
      )
    ).then(() => {
      window.openedWindowIds = []
    })
  }
})

let port

browser.contextMenus.onClicked.addListener(function(info) {
  port.postMessage({ cmd: info.menuItemId })
})

browser.runtime.onConnect.addListener(function(m) {
  port = m
})

browser.runtime.onMessage.addListener(handleInternalMessage)

async function fetchImageAndCopyToClipboard(message, sendResponse)
{
  try 
  {
    let response = await fetch(message, {mode : 'no-cors'})
    let blob = await response.blob()
    let dataURL = await blobToDataURL(blob)
    sendResponse({ status: "success", image: dataURL })
  } catch (error) {
    sendResponse({ status: "error", message: error.message });
  }
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = function() {
      resolve(reader.result);
    };
    reader.onerror = function() {
      reject(new Error("Failed to convert blob to data URL"));
    };
    reader.readAsDataURL(blob);
  });
}
async function sendToSeleniumIDETab(payload, sender, sendResponse) {
  try {
    let tabs = await browser.tabs.query({});

    for (let tab of tabs) {
      if (tab.title.includes("Selenium IDE")) {
        const result = await browser.tabs.sendMessage(tab.id, {type: payload})
        return result;
      }
    }
  } catch (error) {
    console.error(`Error sending message: ${error}`);
  }
}

let setTabID

async function handleInternalMessage(message, sender, sendResponse) {
  if (message.type === "FROM_CONTENT") {
    const result = await sendToSeleniumIDETab(message.payload)
    sendResponse(result)
  }
  else if (message.setTabID) {
    console.log(message)
    setTabID = message.setTabID
  }
  else if (message.nativeData || message.recordData || message.actionResult) {
    SendNativeMessage(message)
  } else if (message.action === "copyImageToClipboard" && message.imageUrl) {
    fetchImageAndCopyToClipboard(message.imageUrl, sendResponse)
  } else if (message.restart && message.controller && message.controller.id) {
    ideWindowId = undefined
    browser.runtime.sendMessage({
      uri: '/private/close',
      verb: 'post',
      payload: null,
    }).then(() => {
      openPanel({ windowId: 0 }).then(() => {
        var payload = { ...message }
        delete payload.restart

        const newMessage = {
          uri: '/private/connect',
          verb: 'post',
          payload: payload,
        }
        browser.runtime.sendMessage(newMessage).then(
          browser.runtime.sendMessage(message.controller.id, {
            connected: true,
          })
        ).catch(() => {
          browser.runtime.sendMessage(
            message.controller.id,
            'Error Connecting to Selenium IDE'
          )
        })
      })
    })
  }
}
browser.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (!message.payload) {
      message.payload = {}
    }

    let payload = message.payload

    payload.sender = sender.id
    if (message.uri.startsWith('/private/')) {
      return sendResponse(false)
    }
    browser.runtime
      .sendMessage(message)
      .then(sendResponse)
      .catch(() => {
        if (message.uri == '/control' && message.verb == 'post') {
          return openPanel({ windowId: 0 }).then(() => {
            const newMessage = {
              uri: '/private/connect',
              verb: 'post',
              payload: {
                controller: {
                  id: payload.sender,
                  name: payload.name,
                  version: payload.version,
                  commands: payload.commands,
                  dependencies: payload.dependencies,
                  jest: payload.jest,
                  exports: payload.exports,
                },
              },
            }
            browser.runtime.sendMessage(newMessage).then(sendResponse)
          })
        } else if (message.openSeleniumIDEIfClosed) {
          return openPanel({ windowId: 0 }).then(() => {
            sendResponse(true)
          })
        } else {
          return sendResponse({ error: 'Selenium IDE is not active' })
        }
      })
    return true
  }
)

browser.runtime.onInstalled.addListener(() => {
// Notify updates only in production
  if (process.env.NODE_ENV === 'production') {
    browser.storage.local.set({
      updated: true,
    })
  }
})

function connect() 
{
  nativePort = chrome.runtime.connectNative(hostName)
  nativePort.onMessage.addListener(function ( message, sender, sendResponse){
    onNativeMessage(message,sender, sendResponse)
    return true
  })
  nativePort.onDisconnect.addListener(onDisconnected)
  console.log("connected.")
}

function onDisconnected() {
  if (chrome.runtime.lastError) {
      console.error(`Disconnected due to: ${chrome.runtime.lastError.message}`)
  } else {
      console.log("Disconnected.")
  }
  nativePort = null
  connect()
}

function findAllTabs() {
  return browser.windows.getAll({ populate: true }).then(windows => {
      const tablist = []
      windows.forEach(window => {
          window.tabs.forEach(tab => {
              if (!tab.url.includes("chrome-extension") && !tab.url.includes("chrome://extensions/")) {
                  tablist.push(tab);
              }
          })
      })
      return tablist
  })
}

function onNativeMessage(receivedData, sender, sendResponse) {
  try {
    let getdata = JSON.parse(receivedData)
    browser.tabs.query({ active: true, currentWindow: true })
    .then(tabs => {
      if (tabs[0]) {
        let filterTab = findAllTabs()
          .then(tabs => {
            return browser.tabs.sendMessage(tabs[0].id, {
              addCommand: {
                command: getdata.command,
                target: getdata.targets,
                value: getdata.value
              }
            })
          })
          .catch(error => {
            console.error("Error:", error)
         })
        }
    })
    .catch(error => {
        console.error("Error:", error)
    })
  } catch (error) {
    console.error("Error parsing received data:", error)
  }
}

function SendNativeMessage(message) {
  const data = (message && message.actionResult) ? message : message.recordData
  if (message.actionResult)
  {
    console.log(`actionResult : ${message.actionResult}`)
  }
  if (nativePort) {
    nativePort.postMessage({ data });
  } else {
    console.log('Native host not connected.')
  }
}

// function onNativeMessage(receivedData, sender, response) {
//   try {
//     let getdata = JSON.parse(receivedData)
//      browser.tabs.query({active: true, currentWindow: true})
//   .then(tabs => {
//     browser.tabs.sendMessage(tabs[0].id, {
//           addCommand: {
//             command: getdata.command,
//             target: getdata.targets,
//             value: getdata.value}
//   })
//   .catch(error => {
//     console.error("Error querying tabs:", error);
//   })})
  
//   function handleRunStateChange() {
//     response(runState);
//     document.removeEventListener('runStateChange', handleRunStateChange)
//   }

//   document.addEventListener('runStateChange', handleRunStateChange)
  

//   } catch (error) {
//     console.error("Error parsing received data:", error)
//   }
// }

connect()