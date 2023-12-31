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

import React from 'react'
import PropTypes from 'prop-types'
import Modal from '../../Modal'
import DialogContainer from '../Dialog'
import LabelledInput from '../../LabelledInput'
import FlatButton from '../../FlatButton'

export default class BaseUrlDialog extends React.Component {
  static propTypes = {
    isSelectingUrl: PropTypes.bool,
    isInvalid: PropTypes.bool,
    confirmLabel: PropTypes.string,
  }
  render() {
    return (
      <Modal
        className="stripped"
        isOpen={this.props.isSelectingUrl}
        modalTitle={BaseUrlDialogContents.modalTitleElement}
        modalDescription={BaseUrlDialogContents.modalDescriptionElement}
      >
        <BaseUrlDialogContents {...this.props} />
      </Modal>
    )
  }
}

class BaseUrlDialogContents extends React.Component {
  componentDidMount() {
    this.props.onUrlSelection(this.state.url)
  }
  componentDidUpdate(prevProps) {
    try{
      if (prevProps.isSelectingUrl !== this.props.isSelectingUrl && this.props.isSelectingUrl) {
          this.props.onUrlSelection(this.state.url);
      }
    }
    catch(exception){
      console.log(exception)
    }
  }
  static modalTitleElement = 'baseUrlTitle'
  static modalDescriptionElement = 'baseUrlDescription'
  constructor(props) {
    super(props)
    this.state = {
      url: '',
    }
    this.urlRegex = /^https?:\/\//
    this.onUrlChange = this.onUrlChange.bind(this)
  }
  static propTypes = {
    isInvalid: PropTypes.bool,
    onUrlSelection: PropTypes.func,
    cancel: PropTypes.func,
  }
  onUrlChange(url) {
    this.setState({ url })
  }
  render() {
    return (
      <DialogContainer
        title={
          this.props.isInvalid
            ? 'Project base URL is invalid!'
            : "Set your project's base URL"
        }
        type={this.props.isInvalid ? 'warn' : 'info'}
        buttons={[
          <FlatButton onClick={this.props.cancel} key="cancel">
            cancel
          </FlatButton>,
          <FlatButton
            type="submit"
            disabled={!this.urlRegex.test(this.state.url)}
            onClick={() => {
              this.props.onUrlSelection(this.state.url)
            }}
            key="ok"
          >
            {this.props.confirmLabel || 'confirm'}
          </FlatButton>,
        ]}
        onRequestClose={this.props.cancel}
        modalTitle={BaseUrlDialogContents.modalTitleElement}
        modalDescription={BaseUrlDialogContents.modalDescriptionElement}
      >
        <p>
          Before you can start recording, you must specify a valid base URL for
          your project. Your tests will start by navigating to this URL.
        </p>
        <LabelledInput
          name="baseUrl"
          label="base url"
          placeholder="http://www.gridone.co.kr/"
          value={this.state.url}
          onChange={this.onUrlChange}
          autoFocus
        />
      </DialogContainer>
    )
  }
}
