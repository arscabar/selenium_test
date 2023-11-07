// Licensed to the Software Freedom Conservancy (SFC) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The SFC licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import Router from '../router'
import apiv1 from './v1'
import PlaybackState from '../neo/stores/view/PlaybackState'
import UiState from '../neo/stores/view/UiState'
import { removeLastCommand} from '../neo/IO/SideeX/record'

const router = new Router()
router.use('/v1', apiv1)
router.use(undefined, apiv1)

async function checkRecordingState(attempts = 0) {
  const maxAttempts = 10
  const delay = 300

  if (UiState.isRecording || attempts >= maxAttempts) {
      if (UiState.isRecording) 
      {
          await removeLastCommand()
          return true
      } else 
      {
          console.log("Failed to start recording after multiple attempts")
          return false
      }
  }

  await UiState.toggleRecord()
  console.log("UiState.isRecording is False, toggleRecord Call")
  return await new Promise(resolve => {
      setTimeout(async () => {
          const result = await checkRecordingState(attempts + 1)
          resolve(result)
      }, delay)
  })
}

export default async function(message, _backgroundPage, sendResponse) {  
  // The sender is always the background page since he is the one listening to the event
  // message.sender is the external extension id
  try {
    if (message.type == "PlayAction") {
      await UiState.stopRecording()
      if (message.length == 1)
      {
        await PlaybackState.startPlaying()
        console.log("startPlaying")
      }
      else if (message.length > 1)
      {
        console.log(message.command)
        console.log("length is 1 over")
        await PlaybackState.playCommand(message.command)
      } 
    } else if (message.type == "RecordingStart") {
      console.log("RecordingStart")
      const isSuccess = await checkRecordingState();
      console.log(`checkRecordingState is ${isSuccess}`)
      if (!isSuccess) {
        sendResponse("Error")
      } else {
        // console.log("checkRecordingState is false")
        // await removeLastCommand()
        sendResponse("recording")
      }
    } else if (message.uri) {
      router
        .run(message)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }))
    }
  } catch (exception) {
    console.log(exception)
  }
  return true
}
