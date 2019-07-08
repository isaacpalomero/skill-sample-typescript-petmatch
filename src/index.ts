/* eslint-disable  func-names */
/* eslint-disable  no-restricted-syntax */
/* eslint-disable  no-loop-func */
/* eslint-disable  consistent-return */
/* eslint-disable  no-console */
/* eslint-disable max-len */
/* eslint-disable prefer-destructuring */

import { RequestHandler, HandlerInput, ErrorHandler, SkillBuilders } from "ask-sdk-core";
import { Response, SessionEndedRequest, IntentRequest, Slot } from "ask-sdk-model";
import * as https from "https";

/* INTENT HANDLERS */

class LaunchRequestHandler implements RequestHandler {
  public canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === "LaunchRequest";
  }
  public handle(handlerInput: HandlerInput): Response {
    return handlerInput.responseBuilder
      .speak("Welcome to pet match. I can help you find the best dog for you. " +
        "What are two things you are looking for in a dog?")
      .reprompt("What size and temperament are you looking for in a dog?")
      .getResponse();
  }
}

class MythicalCreaturesHandler implements RequestHandler {
  public canHandle(handlerInput: HandlerInput): boolean {
    if (handlerInput.requestEnvelope.request.type !== "IntentRequest"
      || handlerInput.requestEnvelope.request.intent.name !== "PetMatchIntent") {
      return false;
    }

    let isMythicalCreatures = false;
    if (handlerInput.requestEnvelope.request.intent.slots
      && handlerInput.requestEnvelope.request.intent.slots.pet
      && handlerInput.requestEnvelope.request.intent.slots.pet.resolutions
      && handlerInput.requestEnvelope.request.intent.slots.pet.resolutions
      && handlerInput.requestEnvelope.request.intent.slots.pet.resolutions.resolutionsPerAuthority
      && handlerInput.requestEnvelope.request.intent.slots.pet.resolutions.resolutionsPerAuthority[0]
      && handlerInput.requestEnvelope.request.intent.slots.pet.resolutions.resolutionsPerAuthority[0].values
      && handlerInput.requestEnvelope.request.intent.slots.pet.resolutions.resolutionsPerAuthority[0].values[0]
      && handlerInput.requestEnvelope.request.intent.slots.pet.resolutions.resolutionsPerAuthority[0].values[0].value
      && handlerInput.requestEnvelope.request.intent.slots.pet.resolutions.resolutionsPerAuthority[0].values[0].value.name === "mythical_creatures") {
      const attributesManager = handlerInput.attributesManager;
      const sessionAttributes = attributesManager.getSessionAttributes();
      sessionAttributes.mythicalCreature = handlerInput.requestEnvelope.request.intent.slots.pet.value;
      attributesManager.setSessionAttributes(sessionAttributes);
      isMythicalCreatures = true;
    }

    return isMythicalCreatures;
  }
  public handle(handlerInput: HandlerInput): Response {
    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes();

    const outputSpeech = randomPhrase(slotsMeta.pet.invalid_responses).replace("{0}", sessionAttributes.mythicalCreature);

    return handlerInput.responseBuilder
      .speak(outputSpeech)
      .getResponse();
  }
}

class InProgressPetMatchIntent implements RequestHandler {
  public canHandle(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;

    return request.type === "IntentRequest"
      && request.intent.name === "PetMatchIntent"
      && request.dialogState !== "COMPLETED";
  }
  public handle(handlerInput: HandlerInput): Response {
    const currentIntent = (handlerInput.requestEnvelope.request as IntentRequest).intent;
    let prompt = "";

    for (const slotName in currentIntent.slots) {
      if (Object.prototype.hasOwnProperty.call(currentIntent.slots, slotName)) {
        const currentSlot = currentIntent.slots[slotName];
        if (currentSlot.confirmationStatus !== "CONFIRMED"
          && currentSlot.resolutions
          && currentSlot.resolutions.resolutionsPerAuthority
          && currentSlot.resolutions.resolutionsPerAuthority[0]) {
          if (currentSlot.resolutions.resolutionsPerAuthority[0].status.code === "ER_SUCCESS_MATCH") {
            if (currentSlot.resolutions.resolutionsPerAuthority[0].values.length > 1) {
              prompt = "Which would you like";
              const size = currentSlot.resolutions.resolutionsPerAuthority[0].values.length;

              currentSlot.resolutions.resolutionsPerAuthority[0].values
                .forEach((element, index) => {
                  prompt += ` ${(index === size - 1) ? " or" : " "} ${element.value.name}`;
                });

              prompt += "?";

              return handlerInput.responseBuilder
                .speak(prompt)
                .reprompt(prompt)
                .addElicitSlotDirective(currentSlot.name)
                .getResponse();
            }
          } else if (currentSlot.resolutions.resolutionsPerAuthority[0].status.code === "ER_SUCCESS_NO_MATCH") {
            if (requiredSlots.indexOf(currentSlot.name) > -1) {
              prompt = `What ${currentSlot.name} are you looking for`;

              return handlerInput.responseBuilder
                .speak(prompt)
                .reprompt(prompt)
                .addElicitSlotDirective(currentSlot.name)
                .getResponse();
            }
          }
        }
      }
    }

    return handlerInput.responseBuilder
      .addDelegateDirective(currentIntent)
      .getResponse();
  }
}

class CompletedPetMatchIntent implements RequestHandler {
  public canHandle(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;

    return request.type === "IntentRequest"
      && request.intent.name === "PetMatchIntent"
      && request.dialogState === "COMPLETED";
  }
  public async handle(handlerInput: HandlerInput): Promise<Response> {
    const { intent } = (handlerInput.requestEnvelope.request as IntentRequest);
    const filledSlots = intent.slots;

    const slotValues = getSlotValues(filledSlots!);
    const petMatchOptions = buildPetMatchOptions(slotValues!);

    let outputSpeech = "";

    try {
      const response = await httpGet(petMatchOptions);

      if (response.result.length > 0) {
        outputSpeech = `So a ${slotValues.size.resolved}
          ${slotValues.temperament.resolved}
          ${slotValues.energy.resolved}
          energy dog sounds good for you. Consider a
          ${response.result[0].breed}`;
      } else {
        outputSpeech = `I am sorry I could not find a match
          for a ${slotValues.size.resolved}
          ${slotValues.temperament.resolved}
          ${slotValues.energy.resolved} dog`;
      }
    } catch (error) {
      outputSpeech = "I am really sorry. I am unable to access part of my memory. Please try again later";
      console.log(`Intent: ${intent.name}: message: ${error.message}`);
    }

    return handlerInput.responseBuilder
      .speak(outputSpeech)
      .getResponse();
  }
}

class FallbackHandler implements RequestHandler {
  public canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === "IntentRequest"
      && handlerInput.requestEnvelope.request.intent.name === "AMAZON.FallbackIntent";
  }
  public handle(handlerInput: HandlerInput): Response {
    return handlerInput.responseBuilder
      .speak("I'm sorry Pet Match can't help you with that. " +
        "I can help find the perfect dog for you. What are two things you're " +
        "looking for in a dog?")
      .reprompt("What size and temperament are you looking for?")
      .getResponse();
  }
}

class HelpHandler implements RequestHandler {
  public canHandle(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;

    return request.type === "IntentRequest"
      && request.intent.name === "AMAZON.HelpIntent";
  }
  public handle(handlerInput: HandlerInput): Response {
    return handlerInput.responseBuilder
      .speak("This is pet match. I can help you find the perfect pet for you. You can say, I want a dog.")
      .reprompt("What size and temperament are you looking for in a dog?")
      .getResponse();
  }
}

class ExitHandler implements RequestHandler {
  public canHandle(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;

    return request.type === "IntentRequest"
      && (request.intent.name === "AMAZON.CancelIntent"
        || request.intent.name === "AMAZON.StopIntent");
  }
  public handle(handlerInput: HandlerInput): Response {
    return handlerInput.responseBuilder
      .speak("Bye")
      .getResponse();
  }
}

class SessionEndedIntentRequest implements RequestHandler {
  public canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === "SessionEndedRequest";
  }
  public handle(handlerInput: HandlerInput): Response {
    console.log(`Session ended with reason: ${(handlerInput.requestEnvelope.request as SessionEndedRequest).reason}`);
    return handlerInput.responseBuilder.getResponse();
  }
}

class CustomErrorHandler implements ErrorHandler {
  public canHandle() {
    return true;
  }
  public handle(handlerInput: HandlerInput, error: Error): Response {
    console.log(`Error handled: ${handlerInput.requestEnvelope.request.type} ${handlerInput.requestEnvelope.request.type === "IntentRequest" ? `intent: ${handlerInput.requestEnvelope.request.intent.name} ` : ""}${error.message}.`);

    return handlerInput.responseBuilder
      .speak("Sorry, I can't understand the command. Please say again.")
      .reprompt("Sorry, I can't understand the command. Please say again.")
      .getResponse();
  }
}

/* CONSTANTS */

const petMatchApi = {
  hostname: "e4v7rdwl7l.execute-api.us-east-1.amazonaws.com",
  pets: "/Test",
};

const requiredSlots = [
  "energy",
  "size",
  "temperament",
];

const slotsMeta = {
  pet: {
    invalid_responses: [
      "I'm sorry, but I'm not qualified to match you with {0}s.",
      "Ah yes, {0}s are splendid creatures, but unfortunately owning one as a pet is outlawed.",
      "I'm sorry I can't match you with {0}s.",
    ],
    error_default: "I'm sorry I can't match you with {0}s.",
  },
};

/* HELPER FUNCTIONS */

/* function buildPastMatchObject(response: any, slotValues: any) {
  return {
    match: response.result,
    pet: slotValues.pet.resolved,
    energy: slotValues.energy.resolved,
    size: slotValues.size.resolved,
    temperament: slotValues.temperament.resolved,
  };
}

function saveValue(options: any, handlerInput: HandlerInput) {
  const key = `_${options.fieldName}`;
  const attributes = handlerInput.attributesManager.getSessionAttributes();

  if (options.append && attributes[key]) {
    attributes[key].push(options.data);
  } else if (options.append) {
    attributes[key] = [options.data];
  } else {
    attributes[key] = options.data;
  }
} */

interface SlotValue {
  synonym?: string;
  resolved?: string;
  isValidated: boolean;
}

function getSlotValues(filledSlots: { [key: string]: Slot }) {
  const slotValues: { [key: string]: SlotValue } = {};

  console.log(`The filled slots: ${JSON.stringify(filledSlots)}`);
  Object.keys(filledSlots).forEach((item) => {
    const name = filledSlots[item].name;

    if (filledSlots[item] &&
      filledSlots[item].resolutions &&
      filledSlots[item].resolutions!.resolutionsPerAuthority &&
      filledSlots[item].resolutions!.resolutionsPerAuthority![0] &&
      filledSlots[item].resolutions!.resolutionsPerAuthority![0].status &&
      filledSlots[item].resolutions!.resolutionsPerAuthority![0].status.code) {
      switch (filledSlots[item].resolutions!.resolutionsPerAuthority![0].status.code) {
        case "ER_SUCCESS_MATCH":
          slotValues[name] = {
            synonym: filledSlots[item].value,
            resolved: filledSlots[item].resolutions!.resolutionsPerAuthority![0].values[0].value.name,
            isValidated: true,
          };
          break;
        case "ER_SUCCESS_NO_MATCH":
          slotValues[name] = {
            synonym: filledSlots[item].value,
            resolved: filledSlots[item].value,
            isValidated: false,
          };
          break;
        default:
          break;
      }
    } else {
      slotValues[name] = {
        synonym: filledSlots[item].value,
        resolved: filledSlots[item].value,
        isValidated: false,
      };
    }
  });

  return slotValues;
}

function randomPhrase<T>(array: T[]) {
  return (array[Math.floor(Math.random() * array.length)]);
}

function buildPetMatchParams(slotValues: { [key: string]: SlotValue }) {
  return [
    ["SSET",
      `canine-${slotValues.energy.resolved}-${slotValues.size.resolved}-${slotValues.temperament.resolved}`],
  ];
}

function buildQueryString(params: any) {
  let paramList = "";
  params.forEach((paramGroup: Array<(string | number | boolean)>, index: number) => {
    paramList += `${index === 0 ? "?" : "&"}${encodeURIComponent(paramGroup[0])}=${encodeURIComponent(paramGroup[1])}`;
  });
  return paramList;
}

interface BuildHttpGetOptions {
  hostname: string;
  path: string;
  port: number;
  method: "GET" | "POST";
}

function buildHttpGetOptions(host: string, path: string, port: number, params: any): BuildHttpGetOptions {
  return {
    hostname: host,
    path: path + buildQueryString(params),
    port,
    method: "GET",
  };
}

function buildPetMatchOptions(slotValues: { [key: string]: SlotValue }) {
  const params = buildPetMatchParams(slotValues);
  const port = 443;
  return buildHttpGetOptions(petMatchApi.hostname, petMatchApi.pets, port, params);
}

function httpGet(options: BuildHttpGetOptions): Promise<any> {
  return new Promise(((resolve, reject) => {
    const request = https.request(options, (response) => {
      response.setEncoding("utf8");
      let returnData = "";

      if (response.statusCode === undefined
        || response.statusCode < 200
        || response.statusCode >= 300) {
        return reject(new Error(`${response.statusCode}: ${options.hostname} ${options.path}`));
      }

      response.on("data", (chunk) => {
        returnData += chunk;
      });

      response.on("end", () => {
        resolve(JSON.parse(returnData));
      });

      response.on("error", (error) => {
        reject(error);
      });
    });
    request.end();
  }));
}

const skillBuilder = SkillBuilders.custom();

/* LAMBDA SETUP */
exports.handler = skillBuilder
  .addRequestHandlers(
    new LaunchRequestHandler(),
    new MythicalCreaturesHandler(),
    new InProgressPetMatchIntent(),
    new CompletedPetMatchIntent(),
    new HelpHandler(),
    new FallbackHandler(),
    new ExitHandler(),
    new SessionEndedIntentRequest(),
  )
  .addErrorHandlers(new CustomErrorHandler())
  .lambda();
