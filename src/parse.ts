// Version 1.0.32
var ParseErr = require('./Err').ParseErr
import { trimLeft, trimRight } from './utils'

export enum TagType {
  Helper = '~',
  HelperEnd = '/',
  Block = '#',
  Custom = '?',
  Ref = 'r',
  Exec = '!',
  SelfClosing = 's'
}

export enum templateAttribute {
  Content = 'c',
  Filter = 'f',
  FilterParams = 'fp',
  Params = 'p',
  Name = 'n',
  Err = 'err',
  Results = 'res'
}

export type AstObject = string | TemplateObject

export type Filter = [string, string | undefined]

export interface TemplateObject {
  n?: string
  t?: string
  f: Array<Filter>
  c?: string
  p?: string
  d: Array<AstObject> // Todo: Make this optional
  b?: Array<TemplateObject>
  [index: string]: any
}

export default function Parse(str: string, tagOpen: string, tagClose: string): Array<AstObject> {
  var powerchars = new RegExp(
    '([|()]|=>)|' +
    '\'(?:\\\\[\\s\\w"\'\\\\`]|[^\\n\\r\'\\\\])*?\'|`(?:\\\\[\\s\\w"\'\\\\`]|[^\\\\`])*?`|"(?:\\\\[\\s\\w"\'\\\\`]|[^\\n\\r"\\\\])*?"' + // matches strings
      '|\\/\\*[^]*?\\*\\/|((\\/)?(-|_)?' +
      tagClose +
      ')',
    'g'
  )
  var tagOpenReg = new RegExp('([^]+?)' + tagOpen + '(-|_)?\\s*', 'g')
  var startInd = 0
  var trimNextLeftWs = ''

  function parseTag(): TemplateObject {
    // console.log(JSON.stringify(match))
    var currentObj: TemplateObject = { f: [], d: [] }

    var numParens = 0
    var filterNumber = 0
    var firstChar = str[startInd]
    var currentAttribute: templateAttribute = templateAttribute.Content // default - Valid values: 'c'=content, 'f'=filter, 'fp'=filter params, 'p'=param, 'n'=name
    var currentType: TagType = TagType.Ref // Default
    startInd += 1 // assume we're gonna skip the first character

    if (
      firstChar === TagType.Helper ||
      firstChar === TagType.Block ||
      firstChar === TagType.HelperEnd
    ) {
      currentAttribute = templateAttribute.Name
      currentType = firstChar
    } else if (firstChar === TagType.Exec || firstChar === TagType.Custom) {
      // ? for custom
      currentType = firstChar
    } else {
      startInd -= 1
    }

    function addAttrValue(indx: number, strng?: string) {
      var valUnprocessed = str.slice(startInd, indx) + (strng || '')
      // console.log(valUnprocessed)
      var val = valUnprocessed.trim()
      if (currentAttribute === templateAttribute.Filter) {
        currentObj.f[filterNumber - 1][0] += val // filterNumber - 1 because first filter: 0->1, but zero-indexed arrays
      } else if (currentAttribute === templateAttribute.FilterParams) {
        currentObj.f[filterNumber - 1][1] += val
      } else if (currentAttribute === templateAttribute.Err) {
        if (val) {
          var found = valUnprocessed.search(/\S/)
          ParseErr('invalid syntax', str, startInd + found)
        }
      } else if (currentAttribute) {
        if (currentObj[currentAttribute]) {
          currentObj[currentAttribute] += val
        } else {
          currentObj[currentAttribute] = val
        }
      }
      startInd = indx + 1
    }
    var m
    while ((m = powerchars.exec(str)) !== null) {
      var char = m[1]
      var tagClose = m[2]
      var slash = m[3]
      var wsControl = m[4]
      var i = m.index

      if (char) {
        // Power character
        if (char === '(') {
          if (numParens === 0) {
            if (currentAttribute === templateAttribute.Name) {
              addAttrValue(i)
              currentAttribute = templateAttribute.Params
            } else if (currentAttribute === templateAttribute.Filter) {
              addAttrValue(i)
              currentAttribute = templateAttribute.FilterParams
            }
          }
          numParens++
        } else if (char === ')') {
          numParens--
          if (numParens === 0 && currentAttribute !== templateAttribute.Content) {
            // Then it's closing a filter, block, or helper
            addAttrValue(i)

            currentAttribute = templateAttribute.Err // Reset the current attribute
          }
        } else if (numParens === 0 && char === '|') {
          addAttrValue(i) // this should actually always be whitespace or empty
          currentAttribute = templateAttribute.Filter
          filterNumber++
          //   TODO if (!currentObj.f) {
          //     currentObj.f = [] // Initial assign
          //   }
          currentObj.f[filterNumber - 1] = ['', '']
        } else if (char === '=>') {
          addAttrValue(i)
          startInd += 1 // this is 2 chars
          currentAttribute = templateAttribute.Results
        }
      } else if (tagClose) {
        addAttrValue(i)
        startInd += tagClose.length - 1
        tagOpenReg.lastIndex = startInd
        // console.log('tagClose: ' + startInd)
        trimNextLeftWs = wsControl
        if (slash && currentType === '~') {
          currentType = TagType.SelfClosing
        } // TODO throw err
        currentObj.t = currentType
        return currentObj
      }
    }
    // TODO: Do I need this?
    return currentObj
  }

  function parseContext(parentObj: TemplateObject, firstParse?: boolean): TemplateObject {
    parentObj.b = [] // assume there will be blocks
    var lastBlock: TemplateObject | boolean = false
    var buffer: Array<AstObject> = []

    function pushString(strng: string, wsAhead?: string) {
      if (strng && typeof strng === 'string') {
        var stringToPush = strng.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        if (wsAhead) {
          stringToPush = trimRight(stringToPush, wsAhead)
        }
        if (trimNextLeftWs) {
          stringToPush = trimLeft(stringToPush, trimNextLeftWs)
          trimNextLeftWs = ''
        }
        buffer.push(stringToPush)
      }
    }

    // Random TODO: parentObj.b doesn't need to have t: #
    var tagOpenMatch
    while ((tagOpenMatch = tagOpenReg.exec(str)) !== null) {
      var precedingString = tagOpenMatch[1]
      var ws = tagOpenMatch[2]

      pushString(precedingString, ws)
      startInd = tagOpenMatch.index + tagOpenMatch[0].length

      var currentObj = parseTag()
      // ===== NOW ADD THE OBJECT TO OUR BUFFER =====

      var currentType = currentObj.t
      if (currentType === '~') {
        currentObj = parseContext(currentObj) // currentObj is the parent object
        buffer.push(currentObj)
      } else if (currentType === '/') {
        if (parentObj.n === currentObj.n) {
          if (lastBlock) {
            // If there's a previous block
            lastBlock.d = buffer
            parentObj.b.push(lastBlock)
          } else {
            parentObj.d = buffer
          }
          // console.log('parentObj: ' + JSON.stringify(parentObj))
          return parentObj
        } else {
          throw Error("Helper start and end don't match")
        }
      } else if (currentType === '#') {
        if (lastBlock) {
          // If there's a previous block
          lastBlock.d = buffer
          parentObj.b.push(lastBlock)
        } else {
          parentObj.d = buffer
        }
        lastBlock = currentObj // Set the 'lastBlock' object to the value of the current block

        buffer = []
      } else {
        buffer.push(currentObj)
      }
      // ===== DONE ADDING OBJECT TO BUFFER =====
    }

    if (firstParse) {
      // TODO: more intuitive
      pushString(str.slice(startInd, str.length))
      parentObj.d = buffer
    }

    return parentObj
  }

  var parseResult = parseContext({ f: [], d: [] }, true)
  // console.log(JSON.stringify(parseResult))
  return parseResult.d // Parse the very outside context
}

// TODO: Don't add f[] by default. Use currentObj.f[currentObj.f.length - 1] instead of using filterNumber
