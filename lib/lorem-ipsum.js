"use babel";

import { shell } from "electron";
import { SPLIT_REG_EXP, DEFAULT_CONFIG } from "./config-manager";
import {
  randNth,
  sizedArray,
  wordWrap,
  errorMsg,
  displayConfigTable,
  sentenceCase,
} from "./helpers";
import * as w from "./words";

import * as CNWORD from "./words-cn"

const CN = 'CN'
const EN = 'EN'

export default class LoremIpsum {
  /**
   * @param {Number} size
   * @returns {String} Single word from a word list
   */
  getRandomWord(size) {
    let ret = randNth(w.wordLists[size - 1]);
    ret = ret.replace(/\b\w+\b/g, (word) => {
      return randNth(CNWORD.words)
    })
    return ret;
  }

  /**
   * @returns {String} random series of strings
   */
  getRandomFragment() {
    let ret = randNth(w.fragmentPatterns)
      .map(v => this.getRandomWord(v))
      .join(" ")
      .trim();
    ret = ret.replace(/\s/g, '')
    console.log(ret)
    return ret
  }

  /**
   * @returns {String} connection between words
   */
  getSentenceInter() {
    return Math.random() < 0.5
      ? " " + this.getRandomWord(w.SIZE_SHORT) + " "
      : ", ";
  }

  /**
   * @param {Number} size
   * @returns {String} connect two sentences with an inter connection
   */
  getSentenceConnector(size) {
    /** @returns {String} */
    const randSide = () => this.getRandomSentence(size - 1);
    let ret = randSide() + this.getSentenceInter() + randSide();
    ret = ret.replace(/\s/g, '')
    return ret
  }

  /**
   * @param {Number} size
   * @returns {String} random sentence of size
   */
  getRandomSentence(size) {
    switch (size) {
      case w.SIZE_ANY:
        const randomSize = randNth(w.allSizes);
        return this.getRandomSentence(randomSize);
      case w.SIZE_SHORT:
        return this.getRandomFragment();
      case w.SIZE_MEDIUM:
      case w.SIZE_LONG:
      case w.SIZE_VERY_LONG:
        return this.getSentenceConnector(size);
      default:
        return this.getRandomSentence(DEFAULT_UNIT_SIZE);
    }
  }

  /**
   * @param {Number} size
   * @returns {String} random paragraph of size
   */
  getRandomParagraph(size) {
    if (size === w.SIZE_ANY) {
      return this.getRandomParagraph(w.DEFAULT_UNIT_SIZE);
    } else if (size === w.SIZE_SHORT) {
      const sentenceCount = Math.floor(Math.random() * 2) + 3;
      return sizedArray(sentenceCount)
        .map(() => sentenceCase(this.getRandomSentence(w.SIZE_ANY)))
        .join("")
        .trim();
    } else {
      return sizedArray(2)
        .map(() => this.getRandomParagraph(size - 1))
        .join("");
    }
  }

  /**
   * @param {Number} count
   * @param {Number} size
   * @returns {String} string with `count` words of length size
   */
  getRandomWords(count, size) {
    let ret = sizedArray(count)
      .map(() => this.getRandomWord(size))
      .join(" ")
      .trim();
    ret = ret.replace(/\s/g, '')
    return ret
  }

  /**
   * @param {Number} count
   * @param {Number} size
   * @returns {String} string with count * sentences of length size
   */
  getRandomSentences(count, size) {
    return sizedArray(count)
      .map(() => sentenceCase(this.getRandomSentence(size)))
      .join("\n\n")
      .trim();
  }

  /**
   * @param {Number} count
   * @param {Number} size
   * @returns {String} string with count * paragraphs of length size
   */
  getRandomParagraphs(count, size) {
    return sizedArray(count)
      .map(() => this.getRandomParagraph(size))
      .join("\n\n")
      .trim();
  }

  /**
   * @param {Number} count
   * @returns {String} string with count * links
   */
  getRandomLinks(count) {
    return sizedArray(count)
      .map(
        () => `<a href="https://atom.io">\n${this.getRandomFragment()}\n</a>`,
      )
      .join("<br/>\n");
  }

  /**
   * @param {Number} count
   * @param {Boolean} isOrdered
   * @returns {String} string with count * list items
   */
  getRandomList(count, isOrdered) {
    /**
     * @param {String} str
     * @return {String} ordered or unordered list
     */
    const listType = str =>
      isOrdered ? `<ol>\n${str}\n</ol>` : `<ul>\n${str}\n</ul>`;

    return listType(
      sizedArray(count)
        .map(() => `<li>\n${this.getRandomFragment()}\n</li>`)
        .join("\n"),
    );
  }

  /**
   * @param {Object} conf
   * @return {String} final text
   */
  runCommand(conf) {
    // make a copy of conf
    conf = Object.assign({}, conf);

    if (conf.showHelp) {
      shell.openExternal(w.HELP_URL);
      return null;
    }

    let finalText =
      {
        paragraph: this.getRandomParagraphs(conf.unitCount, conf.unitSize),
        sentence: this.getRandomSentences(conf.unitCount, conf.unitSize),
        word: this.getRandomWords(conf.unitCount, conf.unitSize),
        link: this.getRandomLinks(conf.unitCount),
        orderedList: this.getRandomList(conf.unitCount, true),
        unorderedList: this.getRandomList(conf.unitCount, false),
      }[conf.unitType] || null;
    console.log(finalText)
    finalText = finalText.replace(/,/g, '，').replace(/\./g, '。')
    console.log(finalText)
    // To avoid badly formatted HTML, links and lists are never word wrapped
    if (["link", "orderedList", "unorderedList"].includes(conf.unitType)) {
      conf.isWrapped = false;
    }

    if (conf.isWrapped) {
      finalText = wordWrap(finalText, conf.wrapWidth);
    }

    // Ignore _html option for lists, should never be in paragraphs.
    if (["orderedList", "unorderedList"].includes(conf.unitType)) {
      conf.isHTML = false;
    }

    if (conf.isHTML) {
      if (["paragraph", "sentence"].includes(conf.unitType)) {
        // Wrap each individual paragraph, sentence
        finalText = finalText.replace(/\n{2,}/g, "\n</p>\n<p>\n");
      }
      finalText = "<p>\n" + finalText + "\n</p>";
    }

    return finalText;
  }

  /**
   * @param {String} command
   * @returns {String} Lorem Ipsum text.
   */
  parseCommand(command) {
    // split the command into arguments and drop the "lorem"
    const commandArray = command.split(SPLIT_REG_EXP).slice(1);
    // Make a copy of the default configuration object
    let conf = Object.assign({}, DEFAULT_CONFIG);

    // Loop through each argument to assign config values
    for (let command of commandArray) {
      if (!command) {
        if (commandArray.length === 1) {
          return errorMsg("Unrecognized option '_'.");
        } else {
          return errorMsg(
            "Two or more underscore characters adjacent to each other.",
          );
        }
      }

      // assign variable depending on order of string and number
      let str, num;
      if (/^([a-z\?]+)(\d*)$/.test(command)) {
        [_, str, num] = command.match(/^([a-z\?]+)(\d*)$/);
      } else if (/^(\d*)([a-z\?]+)$/.test(command)) {
        [_, num, str] = command.match(/^(\d*)([a-z\?]+)$/);
      } else {
        return errorMsg(`Unrecognized option "_${command}".`);
      }
      const optionString = str;
      const optionInt = parseInt(num);

      /**
       * if optionInt is a finite number, assign the
       * property `prop` in config to optionInt
       * @param {String} prop
       */
      const setIntProp = prop =>
        Number.isFinite(optionInt) && (conf[prop] = optionInt);

      // setup configuration
      switch (optionString) {
        case "p":
          conf.unitType = "paragraph";
          setIntProp("unitCount");
          break;
        case "w":
          conf.unitType = "word";
          setIntProp("unitCount");
          break;
        case "s":
          conf.unitType = "sentence";
          setIntProp("unitCount");
          break;
        case "link":
          conf.unitType = "link";
          setIntProp("unitCount");
          break;
        case "ol":
          conf.unitType = "orderedList";
          setIntProp("unitCount");
          break;
        case "ul":
          conf.unitType = "unorderedList";
          setIntProp("unitCount");
          break;
        case "short":
          conf.unitSize = w.SIZE_SHORT;
          break;
        case "medium":
          conf.unitSize = w.SIZE_MEDIUM;
          break;
        case "long":
          conf.unitSize = w.SIZE_LONG;
          break;
        case "vlong":
          conf.unitSize = w.SIZE_VERY_LONG;
          break;
        case "wrap":
          conf.isWrapped = true;
          setIntProp("wrapWidth");
          break;
        case "nowrap":
          conf.isWrapped = false;
          break;
        case "html":
          conf.isHTML = true;
          break;
        case "?":
        case "help":
          conf.showHelp = true;
          break;
        case "config":
          atom.workspace.open("atom://config/packages/lorem");
          return null;
        default:
          return errorMsg("Unrecognized option '_" + command + "'.");
      }
    }

    // log the configuration for developing
    displayConfigTable(conf);

    return this.runCommand(conf);
  }
}
