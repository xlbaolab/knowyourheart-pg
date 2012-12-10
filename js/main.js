/**
 * Protect console logging calls, e.g. F12 dev tools must be open on IE for
 * console to be defined.
 */
if ( typeof console === "undefined" || !console.log) {
  window.console = {
    debug : function() {
    },
    trace : function() {
    },
    log : function() {
    },
    info : function() {
    },
    warn : function() {
    },
    error : function() {
    }
  };
}

console.debug("loading main.js")

/*
 * Constants
 */
var IS_IOS = navigator.userAgent.match(/(iPad|iPhone|iPod)/i) ? true : false;
var MAPS_URL = IS_IOS ? "http://maps.apple.com/maps?q=" : "http://maps.google.com/maps?q=";
var ARCHIMEDES_URL = "https://demo-indigo4health.archimedesmodel.com/IndiGO4Health/IndiGO4Health";
// callback indicates JSONP, which seems necessary
var SURESCRIPTS_URL = "https://millionhearts.surescripts.net/test/Provider/Find?callback=?";
var SURESCRIPTS_API_KEY = "3a0a572b-4f5d-47a2-9a75-819888576454";

/*
 * Text
 */
var TXT = {};
TXT.ADDRESS_NOT_FOUND = "Address not found";
TXT.CLINICS_NOT_FOUND = "No clinics were found nearby";
TXT.INTERVENTIONS_LOCKED_EXPLANATION = "More information is required to \
calculate which actions will be best for you.";
TXT.REWARDS_LOCKED_EXPLANATION = "Know your heart and get rewarded!";

var TXT_INCOMPLETE = "<span>INCOMPLETE</span>";
var TXT_HIGH_BP = "You may have elevated blood pressure. You should consult \
with your doctor or primary care provider about things you can do to control \
it.";
var TXT_HIGH_CHOL = "Your cholesterol levels exceed national standards and \
are contributing to your risk. You should consult with your physician about \
things you can do to improve your cholesterol levels.";

/*
 * Templates
 */
// vars: dataTheme, pageId, name, distance
var LOC_LI_TEMPLATE = _.template('\
  <li class="provider" data-theme="<%= dataTheme %>">\
    <a href="#screening-location?index=<%= index %>" data-transition="slide">\
      <div class="li-primary">\
        <%= name %>\
      </div>\
      <div class="li-secondary">\
        <%= address %> (<%= distance %> miles)\
      </div>\
    </a>\
  </li>\
');

var LOC_MARKER_TEMPLATE = _.template('\
  <div class="info-window">\
    <a href="#screening-location?index=<%= index %>" data-transition="pop">\
      <div>\
        <p class="name">\
          <%= name %>\
        </p>\
        <p class="address">\
          <%= address %>\
          <span class="icon-right ui-icon-shadow ui-icon ui-icon-arrow-r"></span>\
        </p>\
      </div>\
    </a>\
  </div>\
');

var POPUP_LOCKED_HTML = '\
  <div data-role="popup" id="popupLocked" class="ui-content">\
    <a href="#" data-rel="back" data-role="button" data-theme="a" data-icon="delete" data-iconpos="notext" class="ui-btn-right"> Close </a>\
    <strong>THIS FEATURE IS LOCKED</strong>\
    <p class="explanation"></p>\
    <p>\
      Enter your blood pressure, cholesterol, and HbA1c (if applicable)\
      to unlock.\
    </p>\
  </div>\
';

// vars: items, limit
var NEXT_STEPS_TEMPLATE = _.template('\
  <% var added=0; %>\
  <% for (var key in items) { %>\
  <% var item = items[key]; %>\
  <% if (item.hide) { continue; } %>\
  <li class="<%= item.clazz %> <% if (item.lock) { print(\'locked\'); } %> next-step"\
    data-theme="<%= added++ % 2 ? "a" : "e" %>">\
    <a href="<%= item.href %>" <% if (item.popup) { print("data-rel=\'popup\'"); } else { print("data-transition=\'slide\'"); }%>>\
      <div class="li-primary">\
        <%= added + ". " + item.primary %>\
        <% if (item.warning) { print("<span class=\'icon-warning\'></span>"); } %>\
      </div>\
      <div class="li-secondary">\
        <%= item.secondary %>\
      </div>\
    </a>\
  </li>\
  <% if (added === limit) { break; } %>\
  <% } %>\
');

var gNextStepsItems = {
  locations : {
    clazz : "screening-locations-map",
    href : "#screening-locations-map",
    primary : "Find a health screening clinic",
    // Your [hba1c/bp/chol] levels are needed for a more accurate risk assessment
    secondary : "",
    hide : false,
    warning : true
  },
  enterMissing : {
    clazz : "missing",
    href : "", // history, bp, or chol
    primary : "", // Enter your [hba1c/bp/chol]
    secondary : TXT_INCOMPLETE,
    hide : false,
    warning : true
  },
  interventions : {
    clazz : "interventions",
    href : "#interventions",
    primary : "Take action to lower your risk",
    secondary : "By up to <span class='reduction'>?</span>%",
    popup : false,
    lock : false
  },
  extra : {
    clazz : "extra",
    href : "#bp-meds",
    primary : "Improve your risk estimate",
    secondary : "Answer a few more questions for a more accurate assessment",
    hide : false
  },
  rewards : {
    clazz : "rewards",
    href : "#rewards",
    primary : "Get Rewards",
    secondary : "Enter to win a $20 Target gift card",
    popup : false,
    lock : false
  },
  share : {
    clazz : "share",
    href : "#share",
    primary : "Share",
    secondary : "Your friends and family need to know their risk",
  }
};

var gNextStepsItemsCompiled = null;
var gNextStepsItemsState = null;

function compileNextStepsItems(nextStepsItemsState) {
  if (nextStepsItemsState !== gNextStepsItemsState) {
    gNextStepsItemsState = nextStepsItemsState;
    gNextStepsItemsCompiled = NEXT_STEPS_TEMPLATE({
      items : gNextStepsItems,
      limit : 4
    });
  }
  return gNextStepsItemsCompiled;
}

var RISK_MESSAGE = _.template("Your risk is <%= comparisonRisk %> times what \
is healthy for your age.");
var RISK_MESSAGE_RANGE = _.template("Your risk could be up to <%= \
comparisonRisk %> times what is healthy for your age.");
var RISK_REC = {
  0 : _.template(""),
  1 : _.template("It is important for you to check your <%= missingInput %> \
  to understand your risk better, and keep track of it over time."),
  2 : _.template("You may be at high risk for your age. It is important for\
  you to check your <%= missingInput %> to determine your risk, and take action \
  if it is high."),
  3 : _.template("You are likely at very high risk for your age. It is urgent \
  for you to check your <%= missingInput %> to determine your risk, because \
  treatment could be critical.")
};
// var RISK_REC_SHORT = {
  // 0 : _.template(""),
  // 1 : _.template("Getting your <%= missing %> checked will help you understand \
  // your risk better."),
  // 2 : _.template("It is important to check your <%= missing %> \
  // to understand your risk better."),
  // 3 : _.template("It is urgent to check your <%= missing %> because \
  // treatment could be critical.")
// };
var RISK_DOC_REC = {
  0 : _.template('Your heart risk is <%= risk %>. Good job!'),
  1 : _.template('Your heart risk is <%= risk %>. Discuss steps you can take \
  to reduce it with a doctor.'),
  2 : _.template('Your heart risk is <%= risk %>. It is important that you \
  see a doctor to discuss it.'),
  3 : _.template('Your heart risk is <%= risk %>. It is urgent that you see \
  a doctor soon to determine how you can reduce your risk.')
};
// var RISK_DOC_REC_SHORT = {
  // 0 : "Good job! Keep doing what you are doing.",
  // 1 : "Discuss your heart risk and how to reduce it with a doctor.",
  // 2 : "It is important to see a doctor to discuss your heart risk.",
  // 3 : "It is urgent to see a doctor soon to determine how to reduce your risk."
// };
var RISK_RATING = {
  1 : "low",
  2 : "moderate",
  3 : "high",
  4 : "very high",
  5 : "extremely high",
  6 : "unknown"
};

var RESULTS_TEMPLATE = _.template('\
  <div class="ui-grid-a">\
    <div class="ui-block-a absolute">\
      <div class="heart-meter"></div>\
    </div>\
    <div class="ui-block-b absolute">\
      <h3>Your Risk Today:</h3>\
      <p class="rating">\
        <%= RISK_RATING[absRating].toUpperCase() %>\
      </p>\
      <p>\
        Your risk for a heart attack or stroke in the next 5 years is \
        <strong><%= absRisk %></strong>.\
      </p>\
    </div>\
    <div class="ui-block-a divider"></div>\
    <div class="ui-block-b divider"></div>\
    <div class="ui-block-a relative">\
      <div class="heart-meter"></div>\
    </div>\
    <div class="ui-block-b relative">\
      <h3>Your Risk vs Age Group:</h3>\
      <p class="rating">\
        <%= RISK_RATING[relRating].toUpperCase() %>\
      </p>\
      <p>\
        Your risk is <strong><%= relRisk %></strong> times what is healthy \
        for your age.\
      </p>\
    </div>\
  </div>\
  <p class="note" <% if (!showScreeningReqNote) print(\'style="display:none;"\'); %>>\
    * Without knowing your <%= missingInput %>, we can only calculate a range\
  </p>\
');

var RESULTS_POPUP_TEMPLATE = _.template('\
  <a href="#assessment2" data-rel="back" data-role="button" data-theme="a"\
  data-icon="delete" data-iconpos="notext" class="ui-btn-right"> </a>\
  <h3>Your Cardiovascular Risk</h3>\
  <p class="note" <% if (!showScreeningReqNote) print(\'style="display:none;"\'); %>>\
    <em>Note: To give you a more accurate risk assessment, we need to know \
    your <%= missingInput %></em>\
  </p>\
  <table>\
    <tr>\
      <td class="value"><%= absRisk %></td><td>risk of having a heart attack or stroke within the next 5 years</td>\
    </tr>\
    <tr>\
      <td class="value"><%= relRisk %></td><td>times what is considered healthy for your age</td>\
    </tr>\
    <tr>\
      <td class="value"><%= perRisk %></td><td>percentile for your age (lower is better)</td>\
    </tr>\
  </table>\
  <h3>Recommendation</h3>\
  <p class="recommendation"><%= rec %></p>\
');


// survey pages and their inputs, mapped to user attrs
var UI_MAP = {
  "age" : {
    "age-field" : "age"
  },
  "gender" : {
    "gender-male-radio" : "gender",
    "gender-female-radio" : "gender"
  },
  "height" : {
    "height-ft-select" : "height_ft",
    "height-in-select" : "height_in"
  },
  "weight" : {
    "weight-field" : "weight"
  },
  "smoker" : {
    "smoker-toggle" : "smoker"
  },
  "history" : {
    "mi-toggle" : "ami",
    "stroke-toggle" : "stroke",
    "diabetes-toggle" : "diabetes",
    "hba1c-field" : "hba1c"
  },
  "knows-bp" : {
    "knows-bp-radio-t" : "knows_bp",
    "knows-bp-radio-f" : "knows_bp"
  },
  "blood-pressure" : {
    "systolic-bp-slider" : "systolic",
    "diastolic-bp-slider" : "diastolic"
  },
  "knows-chol" : {
    "knows-chol-radio-t" : "knows_chol",
    "knows-chol-radio-f" : "knows_chol"
  },
  "cholesterol" : {
    "total-chol-slider" : "cholesterol",
    "hdl-slider" : "hdl",
    "ldl-slider" : "ldl"
  },
  "bp-meds" : {
    "bp-meds-toggle" : "bloodpressuremeds",
    "bp-meds-slider" : "bloodpressuremedcount"
  },
  "chol-meds" : {
    "chol-meds-toggle" : "cholesterolmeds"
  },
  "aspirin" : {
    "aspirin-toggle" : "aspirin"
  },
  "moderate-exercise" : {
    "mod-ex-slider" : "moderateexercise"
  },
  "vigorous-exercise" : {
    "vig-ex-slider" : "vigorousexercise"
  },
  "family-history" : {
    "family-toggle" : "familymihistory"
  }
};

// archimedes attrs mapped to user attrs
var ARCHIMEDES_ATTRS = {
  "age" : "age",
  "gender" : "gender",
  "height" : null,
  "weight" : "weight",
  "smoker" : "smoker",
  "mi" : "ami",
  "stroke" : "stroke",
  "diabetes" : "diabetes",
  "systolic" : "systolic",
  "diastolic" : "diastolic",
  "cholesterol" : "cholesterol",
  "hdl" : "hdl",
  "ldl" : "ldl",
  "hba1c" : "hba1c",
  "cholesterolmeds" : "cholesterolmeds",
  "bloodpressuremeds" : "bloodpressuremeds",
  "bloodpressuremedcount" : "bloodpressuremedcount",
  "aspirin" : "aspirin",
  "moderateexercise" : "moderateexercise",
  "vigorousexercise" : "vigorousexercise",
  "familymihistory" : "familymihistory"
};
// user attrs mapped to archimedes attrs
var USER_ATTRS = {
  "age" : "age",
  "gender" : "gender",
  "height_ft" : null,
  "height_in" : null,
  "weight" : "weight",
  "smoker" : "smoker",
  "ami" : "mi",
  "stroke" : "stroke",
  "diabetes" : "diabetes",
  "knows_bp" : null,
  "systolic" : "systolic",
  "diastolic" : "diastolic",
  "knows_chol" : null,
  "cholesterol" : "cholesterol",
  "hdl" : "hdl",
  "ldl" : "ldl",
  "hba1c" : "hba1c",
  "cholesterolmeds" : "cholesterolmeds",
  "bloodpressuremeds" : "bloodpressuremeds",
  "bloodpressuremedcount" : "bloodpressuremedcount",
  "aspirin" : "aspirin",
  "moderateexercise" : "moderateexercise",
  "vigorousexercise" : "vigorousexercise",
  "familymihistory" : "familymihistory"
};
var ARCHIMEDES_DEFAULTS = {
  age : 18, // 18 to 85 years
  gender : "M", // M/F
  height : 70, // 44 to 87 inches
  weight : 160, // 80 to 600 pounds
  smoker : false,
  mi : false,
  stroke : false,
  diabetes : false,
  systolic : 120, // 80 to 220 mm/Hg
  diastolic : 80, // 40 to 130 mm/Hg
  cholesterol : 200, // 70 to 500 mg/dL
  hdl : 60, // 20 to 130 mg/dL
  ldl : 100, // 40 to 400 mg/dL
  hba1c : 4.8, // 2 to 16 % (typically 1 digit after decimal)
  cholesterolmeds : false,
  bloodpressuremeds : false,
  bloodpressuremedcount : 0, // 1, 2, 3, 4+
  aspirin : false,
  moderateexercise : 4, // 0 to 60 hours
  vigorousexercise : 2, // 0 to 30 hours
  familymihistory : false
};
var ARCHIMEDES_REQUIRED = {
  age : true,
  gender : true,
  height : true,
  weight : true,
  smoker : true,
  mi : true,
  stroke : true,
  diabetes : true,
  systolic : false,
  diastolic : false,
  cholesterol : false,
  hdl : false,
  ldl : false,
  hba1c : false,
  cholesterolmeds : false,
  bloodpressuremeds : false,
  bloodpressuremedcount : false,
  aspirin : false,
  moderateexercise : false,
  vigorousexercise : false,
  familymihistory : false
};
var USER_DEFAULTS = {
  smoker : "false",
  ami : "false",
  stroke : "false",
  diabetes : "false",
  cholesterolmeds : "false",
  bloodpressuremeds : "false",
  aspirin : "false",
  familymihistory : "false"
};
var REQUIRED_PAGES = {
  "age" : true,
  "gender" : true,
  "height" : true,
  "weight" : true,
  "smoker" : true,
  "history" : true,
  "knows-bp" : true,
  "blood-pressure" : true,
  "knows-chol" : true,
  "cholesterol" : true
};
var EXTRA_PAGES = {
  "bp-meds" : true,
  "chol-meds" : true,
  "aspirin" : true,
  "moderate-exercise" : true,
  "vigorous-exercise" : true,
  "family-history" : true
};
var RISK_IMAGES = {
  1 : {
    background : "url(images/heartmeter3_sprite1.png) no-repeat 0 0"
  },
  2 : {
    background : "url(images/heartmeter3_sprite1.png) no-repeat -94px 0"
  },
  3 : {
    background : "url(images/heartmeter3_sprite1.png) no-repeat -188px 0"
  },
  4 : {
    background : "url(images/heartmeter3_sprite1.png) no-repeat -282px 0"
  },
  5 : {
    background : "url(images/heartmeter3_sprite1.png) no-repeat -376px 0"
  }
};


/*
 * Globals
 */
var gCurrentUser = null;
var gIsFirstPageInit = true;

/*
* Custom Validators
*/
$.tools.validator.fn(
  "#height-ft-select, #height-in-select",
  "Height must be between 3'8\" and 7'3\"",
  function(el, v) {
    var feet = parseInt($("#height-ft-select").val());
    var inches = parseInt($("#height-in-select").val());
    if (isNaN(feet) || isNaN(inches)) {
      return true; // required is validated elsewhere
    }
    var height = feet * 12 + inches;
    return height >= 44 && height <= 87;
  }
);

$.tools.validator.fn(
  "#systolic-bp-slider, #diastolic-bp-slider",
  "Systolic must be greater than diastolic blood pressure",
  function(el, v) {
    var systolic = parseInt($("#systolic-bp-slider").val());
    var diastolic = parseInt($("#diastolic-bp-slider").val());
    if (isNaN(systolic) || isNaN(diastolic)) {
      return true; // required is validated elsewhere
    }
    return systolic > diastolic;
  }
);

$.tools.validator.fn(
  "#hdl-slider, #ldl-slider, #total-chol-slider",
  "Total cholesterol must be greater than HDL + LDL",
  function(el, v) {
    var hdl = parseInt($("#hdl-slider").val());
    var ldl = parseInt($("#ldl-slider").val());
    var total = parseInt($("#total-chol-slider").val());
    if (isNaN(hdl) || isNaN(ldl) || isNaN(total)) {
      return true; // required is validated elsewhere
    }
    return total > hdl + ldl;
  }
);

/*
 * Utility Functions
 */
function generateRandomString() {
  return Math.random().toString(36).substring(2);
}

function isBlank(str) {
  return (!str || /^\s*$/.test(str)) && str !== false;
}

/*
 * Functions
 */
function createUser(user, callbacks) {
  if (_.isUndefined(callbacks)) {
    callbacks = {
      success : function(model) {
        // this gets called twice (once for local and once for StackMob)
        console.info("created user " + model.get("username"));
        gCurrentUser = model;
        localStorage["currentUsername"] = model.get("username");
      },
      error : function(model, response) {
        console.error("failed to create user: " + response.error);
        gCurrentUser = model;
        localStorage["currentUsername"] = model.get("username");
      }
    }
  }
  if (_.isUndefined(user)) {
    user = new User();
  }

  user.create(callbacks);
  return user;
}

function doFirstPageInit() {
  // create a view for each survey page to handle user input
  for (var pageId in UI_MAP) {
    var viewArgs = {
      el : $("#" + pageId),
      inputMap : UI_MAP[pageId],
      model : gCurrentUser
    };
    if (pageId === "bp-meds") {
      new SurveyBpMedsView(viewArgs);
    } else if (pageId === "history") {
      new SurveyHistoryView(viewArgs);
    } else if (pageId === "knows-bp") {
      new SurveyKnowsBpView(viewArgs);
    } else if (pageId === "knows-chol") {
      new SurveyKnowsCholView(viewArgs);
    } else {
      new SurveyView(viewArgs);
    }
  }

  new HomeView({
    el : $("#home"),
    model : gCurrentUser
  });

  new OptionsView({
    el : $("#options"),
    model : gCurrentUser
  });

  new InterventionsView({
    el : $("#interventions"),
    model : gCurrentUser
  });

  var locationsModel = new LocationsModel();

  new LocDetailsView({
    el : $("#screening-location"),
    model : locationsModel
  });

  new LocListView({
    el : $("#screening-locations-list"),
    model : locationsModel
  });

  new LocMapView({
    el : $("#screening-locations-map"),
    model : locationsModel
  });

  new ProfileView({
    el : $("#basic-profile"),
    model : gCurrentUser
  });

  new ExtraProfileView({
    el : $("#extra_profile"),
    model : gCurrentUser
  });

  // new ResultView({
    // el : $("#assessment"),
    // model : gCurrentUser
  // });
  
  new ResultView2({
    el : $("#assessment2"),
    model : gCurrentUser
  });

  new WelcomeView({
    el : $("#welcome"),
    inputMap : {},
    model : gCurrentUser
  });
}

/*
 * StackMob
 */
StackMob.init({
  appName : "knowyourheart",
  clientSubdomain : "peterttsenggmailcom",
  publicKey : "ad81cf6c-4523-411c-a326-f63717789c07",
  apiVersion : 0
});

// addArgs(fn, arg1, arg2, ...)
// function addArgs(fn) {
// var wrapperArgs = arguments;
// return function() {
// var args, i;
// // can't use map function - no IE support
// args = Array.prototype.slice.call(arguments);
// for ( i = 1; i < wrapperArgs.length; i++) {
// args.push(wrapperArgs[i]);
// }
// fn.apply(null, args);
// };
// }

function wrapRemoteError(fn) {
  return function(onError, originalModel, options) {
    // console.debug("wrapRemoteError");
    if (originalModel) {
      originalModel.isFetchingRemote = false;
    }
    fn.apply(null, arguments);
  }
}

function wrapRemoteSuccess(fn) {
  return function(resp, status, xhr) {
    // console.debug("wrapRemoteSuccess");
    if (gCurrentUser) {
      gCurrentUser.isFetchingRemote = false;
    }
    fn.apply(null, arguments);
  }
}

function wrapLocalError(fn) {
  return function(onError, originalModel, options) {
    // console.debug("wrapLocalError");
    if (originalModel) {
      originalModel.isFetchingRemote = false;
    }
    fn.apply(null, arguments);
  }
}

function wrapLocalSuccess(fn) {
  return function(resp, status, xhr) {
    // console.debug("wrapLocalSuccess");
    if (gCurrentUser) {
      gCurrentUser.isFetchingLocal = false;
    }
    fn.apply(null, arguments);
  }
}

// hack - add localStorage support to StackMob's user model
// note that a significant side effect is that callbacks get called twice
StackMob.Model.prototype.localStorage = new Backbone.LocalStorage("user");
StackMob.Model.prototype.sync = function(method, model, options) {
  var successFn = options.success;
  var errorFn = options.error;

  arguments[2].success = wrapLocalSuccess(successFn);
  arguments[2].error = wrapLocalError(errorFn);
  Backbone.LocalStorage.sync.apply(this, arguments);

  arguments[2].success = wrapRemoteSuccess(successFn);
  arguments[2].error = wrapRemoteError(errorFn);
  StackMob.sync.apply(this, arguments);
};

var User = StackMob.User.extend({
  initialize : function(attrs) {
    StackMob.User.prototype.initialize.apply(this, arguments);

    if (_.isUndefined(attrs)) {
      attrs = {
        username : generateRandomString(),
        password : generateRandomString(),
      };
      this.set(attrs);
      
      this.reset();
    }

    this.on("change", this.handleChange, this);
  },
  calculateRisk : function() {
    console.debug("calculateRisk");
    
    // cases to not calculate
    switch(this.get("risk_state")) {
    case User.RISK_STATE.CALCULATING:
      console.debug("already calculating");
      return;
    case User.RISK_STATE.UP_TO_DATE:
      if (this.archimedes_result) {
        console.debug("found up-to-date result");
        return;
      }
      console.debug("up-to-date, but no result found");
      break;
    }

    // wait until later to calculate if we're still fetching
    // TODO replace with better solution
    if (this.isFetching()) {
      console.debug("still fetching")
      return;
    }
    
    this.set("risk_state", User.RISK_STATE.CALCULATING);
    this.archimedes_error = "";

    // build request
    var request = {};
    for (attr in ARCHIMEDES_ATTRS) {
      var userAttr = ARCHIMEDES_ATTRS[attr];
      var val = userAttr === null ? null : this.get(userAttr);
      if (val) {
        if (((attr === "systolic" || attr === "diastolic") && this.needBp()) || 
          ((attr === "cholesterol" || attr === "hdl" || attr === "ldl") && this.needChol()) ||
          ((attr === "hba1c") && (this.get("diabetes") === "false")) ||
          (attr === "bloodpressuremedcount" && this.get("bloodpressuremeds") === "false"))
        {
          continue;
        }
        request[attr] = val;
      } else if (ARCHIMEDES_REQUIRED[attr]) {
        request[attr] = ARCHIMEDES_DEFAULTS[attr];
        if (attr === "height") {
          var feet = parseInt(this.get("height_ft"));
          var inches = parseInt(this.get("height_in"));
          if (!isNaN(feet) && !isNaN(inches)) {
            request[attr] = feet * 12 + inches;
          };
        }
      }
    }

    console.debug("querying Archimedes...");
    console.dir(request);
    $.post(
      ARCHIMEDES_URL,
      request,
      _.bind(this.calculateRiskSuccess, this),
      "text"
    ).fail(_.bind(this.calculateRiskError, this));
  },
  calculateRiskError : function(data) {
    console.dir(data);
    console.error("Error calling Archimedes API: " + data.statusText + " (code " + data.status + ")");
    this.archimedes_error = data.statusText + " (code " + data.status + ")";
    this.set("risk_state", User.RISK_STATE.CHANGED);
  },
  calculateRiskSuccess : function(data) {
    console.dir(data);
    var res = null;
    try {
      res = $.parseJSON(data);
    } catch (e) {
      console.dir(e);
      this.archimedes_error = "Bad response from Archimedes";
    }
    if (res.WarningCode && res.WarningCode !== "0") {
      this.archimedes_error = "Warning code " + res.WarningCode + " from Archimedes";
      res = null;
    } else if (_.size(res.ErrorMessageHashMap) > 0) {
      for (var key in res.ErrorMessageHashMap) {
        this.archimedes_error = res.ErrorMessageHashMap[key];
        break;
      }
      res = null;
    } else if (!res.Risk) {
      this.archimedes_error = "Bad response from Archimedes";
      res = null;
    }
    if (!res) {
      this.set("risk_state", User.RISK_STATE.CHANGED);
    } else {
      this.archimedes_result = res; 
      this.set("archimedes_result", data);
      this.set("risk_state", User.RISK_STATE.UP_TO_DATE);
      this.save();  
    }
  },
  fetch : function() {
    // TODO use events:
    // http://tbranyen.com/post/how-to-indicate-backbone-fetch-progress
    this.isFetchingLocal = true;
    this.isFetchingRemote = true;
    StackMob.User.prototype.fetch.apply(this, arguments);
  },
  getMissingInputStr : function() {
    var needBp = this.needBp();
    var needChol = this.needChol();
    var needHba1c = this.needHba1c();
    var s = "";
    
    if (needBp || needChol || needHba1c) {
      if (needHba1c) {
        if (needBp && needChol) {
          s = "HbA1c, blood pressure, and cholesterol";
        } else if (needBp) {
          s = "HbA1c and blood pressure";
        } else if (needChol) {
          s = "HbA1c and cholesterol";
        } else {
          s = "HbA1c";
        }
      } else if (needBp) {
        if (needChol) {
          s = "blood pressure and cholesterol";
        } else {
          s = "blood pressure";
        }
      } else if (needChol) {
        s = "cholesterol";
      }
    }
    return s;
  },
  handleChange : function(obj, data) {
    for (var attr in data.changes) {
      var val = this.get(attr);
      if (this.isFetching()) {
        if (attr === "archimedes_result") {
          var res = $.parseJSON(val);
          if (res && res.Risk) {
            this.archimedes_result = res;            
          }
        }
        console.debug("user's " + attr + " changed to " + val + " - still fetching");
        continue; 
      } else if (_.has(USER_ATTRS, attr)) {
        console.debug("user's " + attr + " changed to " + val);
        this.set("risk_state", User.RISK_STATE.CHANGED);
      } else if (attr === "risk_state") {
        console.debug("user's " + attr + " changed to " + val + " - triggering " + User.RISK_STATE_CHANGE_EVENT);
        // console.trace();
        this.trigger(User.RISK_STATE_CHANGE_EVENT, val, this);
      } else if (attr !== "lastmoddate"){
        console.debug("user's " + attr + " changed to " + val);
      }
    }
  },
  hasCompletedExtra : function() {
    for (var page in EXTRA_PAGES) {
      var map = UI_MAP[page];
      for (var id in map) {
        if (this.get(map[id]) === "") {
          return false;
        }
      }
    }
    return true;
  },
  hasCompletedRequired : function() {
    return this.get("progress") === "confirmation";
  },
  isFetching : function() {
    return this.isFetchingLocal || this.isFetchingRemote;
  },
  needBp : function() {
    return (this.get("knows_bp") === "false") || !$.isNumeric(this.get("systolic")) || !$.isNumeric(this.get("diastolic"));
  },
  needChol : function() {
    return (this.get("knows_chol") === "false") || !$.isNumeric(this.get("hdl")) || !$.isNumeric(this.get("ldl")) || !$.isNumeric(this.get("cholesterol"));
  },
  needHba1c : function() {
    return (this.get("diabetes") === "true") && !$.isNumeric(this.get("hba1c"));
  },
  reset : function() {
    var attrs = {};
    var attr;
    for (attr in USER_ATTRS) {
      attrs[attr] = "";
    }
    for (attr in USER_DEFAULTS) {
      attrs[attr] = USER_DEFAULTS[attr];
    }
    attrs.archimedes_result = "";
    attrs.progress = "";
    attrs.state = User.RISK_STATE.CHANGED;
    
    this.set(attrs);
  }
}, {
  RISK_STATE_CHANGE_EVENT : "risk-state:change",
  RISK_STATE : {
    CALCULATING : "calculating",
    CHANGED : "changed", // needs to be updated
    UP_TO_DATE : "up-to-date"
  }
});

/*
 * Model
 */
var LocationsModel = Backbone.Model.extend({
  initialize : function(attrs) {
    this.geocoder = new google.maps.Geocoder();
    this.providers = null;
    this.location = null;

    _.extend(this, Backbone.Events);
  },
  geocode : function(address) {
    if (address.length === 0 || $.trim(address.toLowerCase()) === "current location") {
      this.geolocate();
      return;
    }
    
    this.geocoder.geocode({
      "address" : address
    }, _.bind(this.handleGeocode, this));
  },
  geolocate : function() {
    // Try HTML5 geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(_.bind(this.handleGeolocate, this), function(error) {
        // interface PositionError {
        // const unsigned short PERMISSION_DENIED = 1;
        // const unsigned short POSITION_UNAVAILABLE = 2;
        // const unsigned short TIMEOUT = 3;
        // readonly attribute unsigned short code;
        // readonly attribute DOMString message;
        // };
        console.log("Failed to get geolocation");
        console.dir(error);
      });
    } else {
      // Browser doesn't support Geolocation
    }
  },
  handleGeocode : function(result, status) {
    console.debug("geocode returned with status " + status);
    console.dir(result);

    if (status !== google.maps.GeocoderStatus.OK) {
      console.log("Geocoding failed: " + status);
      this.trigger(LocationsModel.ERROR_EVENT, TXT.ADDRESS_NOT_FOUND);
      return;
    }

    this.location = result[0].geometry.location;
    this.trigger(LocationsModel.LOCATION_CHANGE_EVENT, this.location);
    this.querySurescripts();
  },
  handleGeolocate : function(position) {
    this.location = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
    this.trigger(LocationsModel.LOCATION_CHANGE_EVENT, this.location);
    this.querySurescripts();
  },
  handleSurescripts : function(result) {
    this.providers = result.providers;
    this.trigger(LocationsModel.PROVIDERS_CHANGE_EVENT, this.providers);
  },
  querySurescripts : function() {
    $.getJSON(SURESCRIPTS_URL, {
      apikey : SURESCRIPTS_API_KEY,
      lat : this.location.lat(),
      lon : this.location.lng(),
      radius : 50, // TODO - options
      maxResults : 20
    }, _.bind(this.handleSurescripts, this)).fail(function(data) {
      console.error("Error calling Surescripts API: " + data.statusText + " (code " + data.status + ")");
    });
  }
}, {
  ERROR_EVENT : "error",
  LOCATION_CHANGE_EVENT : "location:change",
  PROVIDERS_CHANGE_EVENT : "providers:change"
});

/*
 * Views
 */
var LocDetailsView = Backbone.View.extend({
  initialize : function(attrs) {
  },
  events : {
    "pagebeforeshow" : "updateView"
  },
  updateView : function(e, data) {
    if (this.model.providers === null) {
      return;
    }
    var index = this.$el.data("url").split("=")[1];
    var provider = this.model.providers[index];
    var phone = provider.phone.slice(0, 3) + "-" + provider.phone.slice(3, 6) + "-" + provider.phone.slice(6);

    this.$(".name").html(provider.name);
    this.$(".address a").html(provider.address1 + "<br>" + provider.city + ", " + provider.state + " " + provider.zip.substring(0, 5));
    this.$(".address a").attr("href", MAPS_URL + encodeURIComponent(provider.address1 + ", " + provider.city + ", " + provider.state + ", " + provider.zip.substring(0, 5)));
    this.$(".phone a").html(phone);
    this.$(".phone a").attr("href", "tel:" + provider.phone);
    this.$(".url a").html(provider.urlCaption);
    this.$(".url a").attr("href", provider.url);
    this.$(".description").html(provider.description);
  }
});

var LocListView = Backbone.View.extend({
  initialize : function(attrs) {
    this.$list = this.$("#loc-list");
    this.model.on(LocationsModel.ERROR_EVENT, this.handleError, this);
    this.model.on(LocationsModel.PROVIDERS_CHANGE_EVENT, this.handleProvidersChange, this);
  },
  events : {
    "click" : "handleClick",
    "click .loc-search-btn" : "handleFind",
    "click .nav-map" : "handleNavMapClicked",
    "keypress .loc-search-field" : "handleSearchEnter",
    "pageshow" : "refreshView"
  },
  handleClick : function(e) {
    this.$(".message").fadeOut();
  },
  handleError : function(e) {
    this.$(".message p").html(e);
    this.$(".message").fadeIn();
  },
  handleFind : function() {
    this.$(".message").fadeOut();
    this.model.geocode(this.$(".loc-search-field").val());
  },
  handleNavMapClicked : function(e) {
    e.preventDefault();
    $.mobile.changePage(e.currentTarget.hash, {
      changeHash : false,
      reverse : true,
      transition : "flip"
    });
  },
  handleProvidersChange : function(providers) {
    // clear list
    $("li.provider", this.$list).remove();

    if (providers.length === 0) {
      if ($.mobile.activePage.attr("id") === this.el.id) {
        this.handleError(TXT.CLINICS_NOT_FOUND);
      }
      return;
    }

    for (var i = 0; i < providers.length; i++) {
      var provider = providers[i];

      this.$list.append(LOC_LI_TEMPLATE({
        dataTheme : i % 2 ? "a" : "e",
        index : i,
        name : provider.name,
        address : provider.address1,
        distance : provider.distance.toPrecision(1)
      }));
    }

    this.refreshView();
  },
  handleSearchEnter : function(e) {
    if (e.keyCode == 13) {
      this.handleFind();
    }
  },
  refreshView : function() {
    this.$(".message").hide();
    
    if ($.mobile.activePage.attr("id") === this.el.id) {
      this.$list.listview("refresh");
    }

    if (!this.model.location) {
      this.model.geolocate();
    }
  }
});

var LocMapView = Backbone.View.extend({
  initialize : function(attrs) {
    var options = {
      center : new google.maps.LatLng(37.7652065, -122.24163550000003),
      mapTypeId : google.maps.MapTypeId.ROADMAP,
      zoom : 13
    };
    this.map = new google.maps.Map(this.$(".map")[0], options);
    this.markers = [];
    google.maps.event.addListener(this.map, "click", _.bind(this.handleMapClick, this));
  
    this.model.on(LocationsModel.ERROR_EVENT, this.handleError, this);
    this.model.on(LocationsModel.LOCATION_CHANGE_EVENT, this.handleLocationChange, this);
    this.model.on(LocationsModel.PROVIDERS_CHANGE_EVENT, this.handleProvidersChange, this);
  },
  events : {
    "click" : "handleClick",
    "click .loc-search-btn" : "handleFind",
    "click .nav-list" : "handleNavListClicked",
    "keypress .loc-search-field" : "handleSearchEnter",
    "pageshow" : "refreshView"
  },
  clearMarkers : function() {
    for (var i = 0; i < this.markers.length; i++) {
      this.markers[i].setMap(null);
    }
    this.markers = [];
  },
  handleClick : function(e) {
    this.$(".message").fadeOut();
  },
  handleError : function(e) {
    this.$(".message p").html(e);
    this.$(".message").fadeIn();
  },
  handleFind : function() {
    this.$(".message").fadeOut();
    this.model.geocode(this.$(".loc-search-field").val());
  },
  handleLocationChange : function(location) {
    this.map.panTo(location);
  },
  handleMapClick : function() {
    if (this.infoWindow) {
      this.infoWindow.close();
    }
  },
  handleMarkerClick : function(marker, provider, index) {
    if (this.infoWindow) {
      this.infoWindow.close();
    }
    var content = LOC_MARKER_TEMPLATE({
      address : provider.address1 + "<br>" + provider.city + ", " + provider.state + " " + provider.zip.substring(0, 5),
      // address : provider.crossStreet
      index : index,
      name : provider.name 
    });
    this.infoWindow = new google.maps.InfoWindow({
      map : this.map,
      position : marker.position,
      content : content
    });
  },
  handleNavListClicked : function(e) {
    e.preventDefault();
    $.mobile.changePage(e.currentTarget.hash, {
      changeHash : false,
      transition : "flip"
    });
  },
  handleProvidersChange : function(providers) {
    this.clearMarkers();
    
    if (providers.length === 0) {
      if ($.mobile.activePage.attr("id") === this.el.id) {
        this.handleError(TXT.CLINICS_NOT_FOUND);
      }
      return;  
    }
    
    for (var i = 0; i < providers.length; i++) {
      var provider = providers[i];
      var marker = new google.maps.Marker({
        animation: google.maps.Animation.DROP,
        position : new google.maps.LatLng(provider.lat, provider.lon),
        map : this.map,
        title : provider.name
      });
      google.maps.event.addListener(marker, "click", _.bind(this.handleMarkerClick, this, marker, provider, i));
      this.markers.push(marker);
    }
  },
  handleSearchEnter : function(e) {
    if (e.keyCode == 13) {
      this.handleFind();
    }
  },
  refreshView : function() {    
    this.$(".message").hide();
    
    var windowHeight = $(window).height();
    var headerHeight = this.$(".ui-header").height();
    var footerHeight = this.$(".ui-navbar").height();
    var contentHeight = windowHeight - headerHeight - footerHeight - 3;
    var searchHeight = this.$(".loc-search-bar").outerHeight();
    this.$(".ui-content").height(contentHeight);
    $(this.map.getDiv()).height(contentHeight - searchHeight);

    // needed to make sure map renders correctly on page change
    google.maps.event.trigger(this.map, "resize");

    if (this.model.location) {
      this.map.panTo(this.model.location);
    } else {
      this.model.geolocate();
    }
  }
});

var HomeView = Backbone.View.extend({
  initialize : function(attrs) {
    this.listView = new NextStepListView({
      el : this.$(".next-steps-list"),
      model : this.model,
      page : this
    });
  },
  events : {
    "pagebeforeshow" : "updateView"
  },
  updateView : function(e, data) {
    this.model.calculateRisk();
    this.listView.updateList();
    // might need to init popup since we inserted it (jqm generates the id)
    if (this.$("#popupLocked-popup").length === 0) {
      this.$el.trigger("create");
    }
  }
});

var InterventionsView = Backbone.View.extend({
  initialize : function(attrs) {
    this.model.on(User.RISK_STATE_CHANGE_EVENT, this.handleRiskChange, this);
  },
  events : {
    "pagebeforeshow" : "updateView"
  },
  handleRiskChange : function(state, user) {
    if (state === User.RISK_STATE.UP_TO_DATE) {
      this.updateView();
    }
  },
  updateView : function() {
    var result = this.model.archimedes_result;
    if (!result || !result.Risk) {
      return;
    }

    var interventions = result.Interventions;
    var risk = result.Risk[0];

    this.$(".risk").html(risk.risk);
    this.$(".risk_reduction").html(Math.round(interventions.PercentReductionWithAllInterventions));

    if (interventions.IncreaseInRisk === "0" && interventions.PercentReductionInRiskWithMedication === "0") {
      this.$(".meds").hide();
    } else {
      if (interventions.IncreaseInRisk === "0") {
        this.$(".stop_meds").hide();
      } else {
        this.$(".stop_meds_increase").html(Math.round(interventions.IncreaseInRisk));
        this.$(".stop_meds").show();
      }
      if (interventions.PercentReductionInRiskWithMedication === "0") {
        this.$(".take_meds").hide();
      } else {
        this.$(".take_meds_reduction").html(Math.round(interventions.PercentReductionInRiskWithMedication));
        this.$(".take_meds").show();
      }
      this.$(".meds").show();
    }

    this.$(".moderate_exercise_reduction").html(Math.round(interventions.PercentReductionInRiskWithAdditionalModerateExercise));
    this.$(".vigorous_exercise_reduction").html(Math.round(interventions.PercentReductionInRiskWithAdditionalVigorousExercise));

    if (interventions.PercentReductionInRiskWithWeightLoss === "") {
      this.$(".weight").hide();
    } else {
      this.$(".lose_pounds").html(interventions.PoundsOfWeightLossRequired);
      this.$(".lose_weight_reduction").html(Math.round(interventions.PercentReductionInRiskWithWeightLoss));
      this.$(".weight").show();
    }

    if (interventions.PercentReductionWithSmokingCessation === "0") {
      this.$(".smoking").hide();
    } else {
      this.$(".quit_smoking_reduction").html(Math.round(interventions.PercentReductionWithSmokingCessation));
      this.$(".smoking").hide();
    }
  }
});

var NextStepListView = Backbone.View.extend({
  initialize : function(attrs) {
    this.model.on(User.RISK_STATE_CHANGE_EVENT, this.handleRiskChange, this);
    this.options.page.$el.append(POPUP_LOCKED_HTML);
  },
  events : {
    "click li.interventions" : "handleInterventionsClicked",
    "click li.rewards" : "handleRewardsClicked"
  },
  getRiskReduction : function() {
    var result = this.model.archimedes_result;
    if (!result || !result.Risk || !result.Interventions.PercentReductionWithAllInterventions) {
      return "?";
    } else {
      return Math.round(result.Interventions.PercentReductionWithAllInterventions); 
    }
  },
  handleInterventionsClicked : function(e) {
    this.options.page.$(".explanation").html(TXT.INTERVENTIONS_LOCKED_EXPLANATION);
  },
  handleRewardsClicked : function(e) {
    this.options.page.$(".explanation").html(TXT.REWARDS_LOCKED_EXPLANATION);
  },
  handleRiskChange : function(state, user) {
    var $risk = this.$("li .reduction");

    switch(state) {
    case User.RISK_STATE.UP_TO_DATE:
      $risk.html(this.getRiskReduction());
      break;
    }
  },
  refreshView : function() {
    if (this.options.page.el.id === $.mobile.activePage.attr("id")) {
      this.$el.listview("refresh");
    }
  },
  updateList : function() {
    var i = 0;

    var needBp = this.model.needBp();
    var needChol = this.model.needChol();
    var needHba1c = this.model.needHba1c();
    var completedExtra = this.model.hasCompletedExtra();
    var state = "" + needBp + needChol + needHba1c + completedExtra;

    if (state === this.nextStepsState) {
      // no change
      return;
    }
    this.nextStepsState = state;

    if (needBp || needChol || needHba1c) {
      var missingText;
      if (needHba1c) {
        gNextStepsItems.enterMissing.href = "#history";
        if (needBp && needChol) {
          missingText = "HbA1c, blood pressure, and cholesterol";
        } else if (needBp) {
          missingText = "HbA1c and blood pressure";
        } else if (needChol) {
          missingText = "HbA1c and cholesterol";
        } else {
          missingText = "HbA1c";
        }
      } else if (needBp) {
        gNextStepsItems.enterMissing.href = "#knows-bp";
        if (needChol) {
          missingText = "blood pressure and cholesterol";
        } else {
          missingText = "blood pressure";
        }
      } else if (needChol) {
        gNextStepsItems.enterMissing.href = "#knows-chol";
        missingText = "cholesterol";
      }

      gNextStepsItems.locations.secondary = "<span>Your " + missingText +
      " levels are needed for a more accurate risk assessment</span>";
      gNextStepsItems.locations.hide = false;
      gNextStepsItems.enterMissing.primary = "Enter your missing values";
      gNextStepsItems.enterMissing.secondary = "INCOMPLETE - " + missingText;
      gNextStepsItems.enterMissing.hide = false;
      gNextStepsItems.extra.hide = true;
      gNextStepsItems.interventions.href = "#popupLocked";
      gNextStepsItems.interventions.popup = true;
      gNextStepsItems.interventions.lock = true;
      gNextStepsItems.rewards.href = "#popupLocked";
      gNextStepsItems.rewards.popup = true;
      gNextStepsItems.rewards.lock = true;
    } else {
      gNextStepsItems.locations.hide = true;
      gNextStepsItems.enterMissing.hide = true;
      gNextStepsItems.extra.hide = completedExtra;
      gNextStepsItems.interventions.href = "#interventions";
      gNextStepsItems.interventions.popup = false;
      gNextStepsItems.interventions.lock = false;
      gNextStepsItems.rewards.href = "#rewards";
      gNextStepsItems.rewards.popup = false;
      gNextStepsItems.rewards.lock = false;
    }

    this.$("li.next-step").remove();
    this.$("li.next-steps-header").after(compileNextStepsItems(state));
    this.$("li .reduction").html(this.getRiskReduction());  
    this.refreshView();
    this.$("li.locked .ui-icon-arrow-r").removeClass("ui-icon-arrow-r").addClass("icon-lock");
  },
  updateListContent : function() {
    // TODO: when we need to update the list item contents, e.g. risk
    // value, but not add/remove list items  
  }
});

var OptionsView = Backbone.View.extend({
  initialize : function(attrs) {
  },
  events : {
    "click #reset-btn" : "handleReset",
    "click #cancel-reset-btn" : "handleCancel"
  },
  handleCancel : function(evt) {
    this.$("#popup-confirm-reset").popup("close");
  },
  handleReset : function(evt) {
    // this.model.reset();
    // this.model.save();
    window.localStorage.clear();
    $.mobile.changePage("app.html", {
      transition : "fade"
    });
    window.location.reload();
  }
});

var ProfileView = Backbone.View.extend({
  initialize : function(attrs) {
    this.render();
    this.model.on(User.RISK_STATE_CHANGE_EVENT, this.handleRiskChange, this);
  },
  events : {
    "pagebeforeshow" : "handlePageBeforeShow"
  },
  handlePageBeforeShow : function(e, data) {
    this.model.calculateRisk();
    this.render();
  },
  handleRiskChange : function(state, user) {
    if (this.model.get("risk_state") === User.RISK_STATE.UP_TO_DATE) {
      this.render();
    }
  },
  render : function() {
    var text;
    var user = this.model;

    text = user.get("age");
    this.$(".age").html(isBlank(text) ? "&nbsp;" : text);

    text = user.get("gender");
    text = !text ? "&nbsp;" : (text === "M" ? "Male" : "Female");
    this.$(".gender").html(text);

    var height_ft = user.get("height_ft");
    var height_in = user.get("height_in");
    text = (!height_ft || !height_in) ? "&nbsp;" : height_ft + "' " + height_in + "\"";
    this.$(".height").html(text);

    text = user.get("weight");
    this.$(".weight").html(isBlank(text) ? "&nbsp;" : text + " lbs");

    text = user.get("smoker");
    text = !text ? "&nbsp;" : (text === "true" ? "Yes" : "No");
    this.$(".smoker").html(text);

    this.$(".history .icon-warning").hide();
    text = "";
    if (user.get("ami") === "true") {
      text += "Heart Attack";
    }
    if (user.get("stroke") === "true") {
      text += text.length === 0 ? "" : ", ";
      text += "Stroke";
    }
    if (user.get("diabetes") === "true") {
      text += text.length === 0 ? "" : ", ";
      text += "Diabetes";
      if (isBlank(user.get("hba1c"))) {
        text += "<br>" + TXT_INCOMPLETE + " - HbA1c";
        // show() uses display : block
        this.$(".history .icon-warning").css("display", "inline-block");
      }
    }
    this.$(".history .li-secondary").html(!text ? "&nbsp;" : text);

    var result = user.archimedes_result;
    var systolic = user.get("systolic");
    var diastolic = user.get("diastolic");
    if (user.needBp()) {
      text = TXT_INCOMPLETE;
      this.$(".bp .icon-warning").css("display", "inline-block");
    } else {
      text = systolic + "/" + diastolic;
      if (result && result.Risk && result.ElevatedBloodPressure) {
        text += "<br><br><span class='important'>Warning: " + TXT_HIGH_BP + "</span>";
        this.$(".bp .icon-warning").css("display", "inline-block");
      } else {
        this.$(".bp .icon-warning").hide();
      }
    }
    this.$(".bp .li-secondary").html(text);

    var chol = user.get("cholesterol");
    var hdl = user.get("hdl");
    var ldl = user.get("ldl");
    if (user.needChol()) {
      text = TXT_INCOMPLETE;
      this.$(".chol .icon-warning").css("display", "inline-block");
    } else {
      text = chol + " | " + hdl + " | " + ldl;
      if (result && result.Risk && result.ElevatedCholesterol) {
        text += "<br><br><span class='important'>Warning: " + TXT_HIGH_CHOL + "</span>";
        this.$(".chol .icon-warning").css("display", "inline-block");
      } else {
        this.$(".chol .icon-warning").hide();
      }
    }
    this.$(".chol .li-secondary").html(text);
  }
});

var ExtraProfileView = Backbone.View.extend({
  initialize : function(attrs) {
  },
  events : {
    "pagebeforeshow" : "updateView"
  },
  updateView : function(e, data) {
    var text;
    var user = this.model;
    
    text = user.get("bloodpressuremeds");
    if (!text) {
      text = "&nbsp;";
    } else {
      if (text === "true") {
        text = "Yes - " + user.get("bloodpressuremedcount") + " kinds";
      } else {
        text = "No";
      }
    }
    this.$(".bloodpressuremeds").html(text);

    text = user.get("cholesterolmeds");
    text = !text ? "&nbsp;" : (text === "true" ? "Yes" : "No");
    this.$(".cholesterolmeds").html(text);

    text = user.get("aspirin");
    text = !text ? "&nbsp;" : (text === "true" ? "Yes" : "No");
    this.$(".aspirin").html(text);

    text = user.get("moderateexercise");
    this.$(".moderateexercise").html(isBlank(text) ? "&nbsp;" : text + " hours");

    text = user.get("vigorousexercise");
    this.$(".vigorousexercise").html(isBlank(text) ? "&nbsp;" : text + " hours");

    text = user.get("familymihistory");
    text = !text ? "&nbsp;" : (text === "true" ? "Yes" : "No");
    this.$(".familymihistory").html(text);
  }
});

var ResultView2 = Backbone.View.extend({
  initialize : function() {
    this.listView = new NextStepListView({
      el : this.$(".next-steps-list"),
      model : this.model,
      page : this
    });
    
    this.model.on(User.RISK_STATE_CHANGE_EVENT, this.handleRiskStateChanged, this);
    
    this.render();
  },
  events : {
    "click .retry-button" : "handleRetry",
    "pagebeforeshow" : "handlePageBeforeShow",
  },
  handlePageBeforeShow : function(e, data) {
    this.model.calculateRisk();
    
    this.listView.updateList();
    
    // might need to init popup since we inserted it (jqm generates this id)
    if (this.$("#popupLocked-popup").length === 0) {
      this.$el.trigger("create");
    }
  },
  handleRetry : function() {
    this.model.calculateRisk();
  },
  handleRiskStateChanged : function() {
    this.renderStatus();
    if (this.model.get("risk_state") === User.RISK_STATE.UP_TO_DATE) {
      this.render();
    }
  },
  render : function() {
    var user = this.model;
    var result = user.archimedes_result;
    
    /*
     * risk summary
     * 
     * 3 states - no results, range, results with bp/chol
     */
    var templateArgs = {
      absRating : 6,
      absRisk: "?%",
      highestRating : 6,
      missingInput: user.getMissingInputStr(),
      perRisk: "?",
      rec: "?",
      relRating : 6,
      relRisk: "?",
      showScreeningReqNote: false      
    }
    if (result) {
      var isRange = result.Risk[0].risk == "";
      var riskUpper = result.Risk[ isRange ? 1 : 0];
      var riskLower = result.Risk[ isRange ? 2 : 0];
      templateArgs.absRating = parseInt(riskUpper.rating);
      templateArgs.relRating = parseInt(riskUpper.ratingForAge);
      templateArgs.highestRating = templateArgs.absRating > templateArgs.relRating
        ? templateArgs.absRating : templateArgs.relRating;
      
      if (isRange) {
        templateArgs.absRisk = riskLower.risk + "% to " + riskUpper.risk + "%";
        templateArgs.relRisk = riskLower.comparisonRisk + " to " + riskUpper.comparisonRisk;
        templateArgs.perRisk = riskLower.riskPercentile + " to " + riskUpper.riskPercentile;
        templateArgs.rec = RISK_REC[result.Recommendation](templateArgs);
        templateArgs.showScreeningReqNote = true;
      } else {
        templateArgs.absRisk = riskUpper.risk + "%";
        templateArgs.relRisk = riskUpper.comparisonRisk;
        templateArgs.perRisk = riskUpper.riskPercentile;
        templateArgs.rec = RISK_DOC_REC[result.DoctorRecommendation]({
          risk : RISK_RATING[templateArgs.highestRating]
        });
        templateArgs.showScreeningReqNote = false;
      }
    }
    this.$("#results-summary").html(RESULTS_TEMPLATE(templateArgs));
    this.$(".absolute .rating").attr("risk-rating", templateArgs.absRating);
    this.$(".relative .rating").attr("risk-rating", templateArgs.relRating);
    this.$(".absolute .heart-meter").attr("risk-rating", templateArgs.absRating);
    this.$(".relative .heart-meter").attr("risk-rating", templateArgs.relRating);
    
    this.$("#popup-more-info").html(RESULTS_POPUP_TEMPLATE(templateArgs));
  },
  renderStatus : function() {
    var user = this.model;
    var $statusBar = this.$(".status-bar");
    var message;
    
    switch(user.get("risk_state")) {
    case User.RISK_STATE.CALCULATING:
      this.showStatus(true, false);
      message = "Calculating&hellip;";
      break;
    case User.RISK_STATE.CHANGED:
      this.showStatus(true, true);
      message = user.archimedes_error ? "Calculation failed: " + user.archimedes_error : "";
      break;
    case User.RISK_STATE.UP_TO_DATE:
      this.showStatus(false, true);
      message = "&nbsp;";
      break;
    }
    $statusBar.find("p").html(message);
  },
  showStatus : function(show, enabled) {
    var $statusBar = this.$(".status-bar");
    var $retryBtn = $statusBar.find("input[type=button]");
    var isVisible = this.$el.is(":visible"); 
    if (show) {
      if (isVisible) {
        $statusBar.slideDown("slow");
      } else {
        $statusBar.show();
      }
    } else {
      if (isVisible) {
        $statusBar.slideUp("slow");
      } else {
        $statusBar.hide();
      }      
    }
    if (isVisible) {
      $retryBtn.button(enabled ? "enable" : "disable");
    }
  }
});
  
var ResultView = Backbone.View.extend({
  initialize : function(attrs) {
    this.listView = new NextStepListView({
      el : this.$(".next-steps-list"),
      model : this.model,
      page : this
    });

    this.model.on(User.RISK_STATE_CHANGE_EVENT, this.updateRiskView, this);

    // do it at least once; pageinit doesn't work if this is the initial page
    this.riskViewRendered = false;
  },
  events : {
    "pagebeforeshow" : "handlePageBeforeShow",
  },
  handlePageBeforeShow : function(e, data) {
    this.model.calculateRisk();
    if (!this.riskViewRendered) {
      this.riskViewRendered = true;
      this.updateRiskView();
    }
    this.listView.updateList();
    // might need to init popup since we inserted it (jqm generates this id)
    if (this.$("#popupLocked-popup").length === 0) {
      this.$el.trigger("create");
    }
  },
  updateImage : function(range, rating, $img) {
      $img.css(RISK_IMAGES[rating]);
  },
  updateImage2 : function(rating, ratingForAge) {
    // this.$(".absolute .heart-meter").css(CSS_RISK_METER[rating]);
    // this.$(".relative .heart-meter").css(CSS_RISK_METER[ratingForAge]);
  },
  updateRiskView : function() {
    var user = this.model;
    var result = user.archimedes_result;
    var $error = this.$(".risk_error");
    var $loader = this.$("#circularG");
    var $img = this.$(".heart_meter");

    switch(user.get("risk_state")) {
    case User.RISK_STATE.CALCULATING:
      $error.hide();
      $img.hide();
      $loader.show();
      break;
    // case User.RISK_STATE.ERROR:
      // $img.hide();
      // if (this.$el.is(":visible")) {
        // $loader.fadeOut("slow", function() {
          // $error.fadeIn("slow");
        // });
      // } else {
        // $loader.hide();
        // $error.show();
      // }
      // break;
    case User.RISK_STATE.CHANGED:
    case User.RISK_STATE.UP_TO_DATE:
      if (!result || !result.Risk) {
        // TODO handle bad result
        user.set("risk_state", User.RISK_STATE.CHANGED);
        user.save();
        break;
      }
      
      // update risk image and message
      var range = result.Recommendation !== "";
      var risk = result.Risk[ range ? 1 : 0];
      var risk2 = result.Risk[ range ? 2 : 0];

      var rating = parseInt(risk.rating);
      var ratingForAge = parseInt(risk.ratingForAge);
      var highestRating = rating > ratingForAge ? rating : ratingForAge;
      
      if (isNaN(rating)) {
        user.set("risk_state", User.RISK_STATE.CHANGED);
        user.save();
        break; 
      }
      
      $error.hide();
      if (this.$el.is(":visible")) {
        $error.hide();
        $loader.fadeOut("slow", _.bind(function() {
          $img.fadeIn("slow");
          this.updateImage(range, highestRating, $img);
        }, this));
      } else {
        $loader.hide();
        $img.show();
        this.updateImage(range, highestRating, $img);
      }
      
      this.$(".absolute .rating").html(RISK_RATING[rating].toUpperCase());
      this.$(".absolute .rating").attr("risk-rating", rating);
      this.$(".relative .rating").html(RISK_RATING[ratingForAge].toUpperCase());
      this.$(".relative .rating").attr("risk-rating", ratingForAge)
      this.updateImage2(rating, ratingForAge);

      var missingStr = "";
      if (user.needBp()) {
        missingStr = "blood pressure";
      }
      if (user.needChol()) {
        if (missingStr) {
          missingStr += " and ";  
        }
        missingStr += "cholesterol";
      }
      var msgArgs = {
        comparisonRisk : risk.comparisonRisk,
        missing : missingStr
      };
      var riskMsg;
      if (range) {
        riskMsg = RISK_MESSAGE_RANGE(msgArgs) + "<br><br>Recommendation: " + 
          RISK_REC_SHORT[result.Recommendation](msgArgs);
      } else {
        riskMsg = RISK_MESSAGE(msgArgs) + "<br><br>Recommendation: " +
          RISK_DOC_REC_SHORT[result.DoctorRecommendation];
      }
      this.$(".risk_message").html(riskMsg);

      // popup
      var riskStr = range ? (risk2.risk + "% to " + risk.risk + "%") : (risk.risk + "%");
      var ratioStr = range ? (risk2.comparisonRisk + " to " + risk.comparisonRisk) : risk.comparisonRisk;
      var percentileStr = range ? (risk2.riskPercentile + " to " + risk.riskPercentile) : risk.riskPercentile;
      this.$(".risk").html(riskStr);
      this.$(".ratio").html(ratioStr);
      this.$(".percentile").html(percentileStr);

      var rec = range ? RISK_REC[result.Recommendation](msgArgs) : RISK_DOC_REC[result.DoctorRecommendation]({
        risk : RISK_RATING[highestRating]
      });
      this.$(".recommendation").html(rec);

      if (range) {
        this.$(".accuracy").show();
      } else {
        this.$(".accuracy").hide();
      }
      break;
    }
  }
});

var SurveyView = Backbone.View.extend({
  initialize : function(attrs) {
    for (var input in this.options.inputMap) {
      var userFieldName = this.options.inputMap[input];
      var val = this.model.get(userFieldName);
      if (isBlank(val)) {
        val = "";
      }  
      var $input = this.$("#" + input);

      console.debug("loading input " + userFieldName + "=" + val);

      // remember what we loaded so we know if it changes
      $input.data("loadedValue", val);

      if ($input.prop("nodeName").toLowerCase() === "input") {
        if ($input.prop("type") === "radio") {
          if ($input.val() === val) {
            $input.prop("checked", true)
          }
        } else {
          // type = text, number
          if (val == "") {
            // set the user with the value from the field
            // if ($input.attr("value")) {
            // this.model.set(userFieldName, $input.attr("value"));
            // }
          } else {
            $input.attr("value", val); 
          }
        }
      } else {
        // if ($input.prop("nodeName").toLowerCase() === "select")
        $input.val(val);
      }
    }

    this.nextPageHref = this.$("button[type=submit]").attr("href");
  },
  events : {
    "change input[type=radio]" : "handleChange",
    "change input[type=number]" : "handleChange",
    "change select" : "handleChange",
    "keyup input[type=text]" : "handleChange",
    "keyup input[type=number]" : "handleChange",
    "pagebeforehide" : "handlePagebeforehide",
    "pageshow" : "handlePageshow",
    "submit form" : "handleSubmit"    
  },
  handleChange : function(e, data) {
    // var $input = $(e.currentTarget);
    // console.log($input.prop("nodeName") + " " + e.currentTarget.id);
    // if (this.isLoading || $input.prop("type") === "radio" && !$input.prop("checked")) {
      // return;
    // }
    // var userField = this.options.inputMap[$input.attr("id")];
    // var o = {};
    // o[userField] = $input.val();
    // this.model.set(o);
  },
  handlePagebeforehide : function(e, data) {
    // check when user clicks our/browser's back button (unnecessarily called
    // twice for submit but seems harmless)
    this.validator.checkValidity();
    
    // save if input changed
    var changed = false;
    for (var input in this.options.inputMap) {
      var $input = this.$("#" + input);
      if ($input.prop("type") === "radio" && !$input.prop("checked")) {
        continue;
      }
      var attr = this.options.inputMap[input];
      // var val = this.model.get(attr);
      var val = $input.val();
      var lastVal = $input.data("loadedValue");
      if (val !== lastVal) {
        if ($input.hasClass("invalid")) {
          $input.val(lastVal);
          // var o = {};
          // o[attr] = lastVal;
          // this.model.set(o);
        } else {
          changed = true;
          $input.data("loadedValue", val);
          var o = {};
          o[attr] = val;
          this.model.set(o);
        }
      }
    }
    
    // clear error tooltips
    this.validator.reset();

    var nextPageHref = this.$("button[type=submit]").attr("href");
    if (!this.model.hasCompletedRequired() && nextPageHref !== "#welcome") {
      this.model.set("progress", nextPageHref.slice(1));
      changed = true;
    }

    if (changed) {
      console.info("saving user");
      this.model.save();
    }
  },
  handlePageshow : function(e, data) {
    this.prevPageId = data.prevPage.attr("id");
    this.isLoading = true;
    
    var $submit = this.$("button[type=submit]");
    if (this.manageSubmitTarget === false) {
      // do nothing
    } else if (
      (this.model.hasCompletedRequired() && REQUIRED_PAGES[this.$el.attr("id")]) ||
      (this.model.hasCompletedExtra() && EXTRA_PAGES[this.$el.attr("id")]))
    {
      $submit.attr("href",
        (data.prevPage.length === 0
          || REQUIRED_PAGES[this.prevPageId]
          || EXTRA_PAGES[this.prevPageId])
        ? "#basic-profile"
        : "#" + data.prevPage.attr("id"));
      $submit.attr("data-icon", "check");
      this.$(".ui-submit .ui-icon").addClass("ui-icon-check").removeClass("ui-icon-newarrow-r");
      if ($.trim($submit.html()) === "Next") {
        $submit.html("Save");
      }
    } else {
      $submit.attr("href", this.nextPageHref);
      $submit.attr("data-icon", "newarrow-r");
      this.$(".ui-submit .ui-icon").addClass("ui-icon-newarrow-r").removeClass("ui-icon-check");
      if ($.trim($submit.html()) === "Save") {
        $submit.html("Next");
      }
    }
    $submit.button("refresh");
    
    this.$("input[type=radio]").checkboxradio("refresh");
    this.$("input.ui-slider-input").slider("refresh");
    this.$("select[data-role=slider]").slider("refresh");
    this.$("select[data-role!=slider]").selectmenu("refresh");
    
    // must initialize after jqm controls
    if (!this.validator) {
      this.$("form").validator({
        message : "<div><em/></div>", // em element is the arrow
        offset : [-16, -30],
        position : "top left",
        singleError : true
      });
      this.validator = this.$("form").data("validator");
    }
    
    this.isLoading = false;
  },
  handleSubmit : function(e) {
    e.preventDefault();

    // don't continue if validation failed
    // note: need to check the node name because the "invalid" class sometimes
    // gets misapplied for selects (validation fails, change selection, span
    // receives "invalid" class)
    var $invalids = this.$(".invalid");
    if ($invalids.length > 0) {
      for (var i=0; i<$invalids.length; i++) {
        var $node = $($invalids[0]);
        var name = $node.prop("nodeName").toLowerCase();
        if (name === "input" || name === "select") {
          if ($node.is(":visible")) {
            return;
          } else {
            $node.val("");
          }
        }
      }
    }

    var $submit = this.$("button[type=submit]");
    var options = {};
    if (REQUIRED_PAGES[this.prevPageId] || EXTRA_PAGES[this.prevPageId]) {
      options.transition = "slide";
    } else {
      options.reverse = $submit.attr("data-icon") !== "newarrow-r";
      options.transition = "slide";
    }
    $.mobile.changePage($submit.attr("href"), options);
  }
});

var SurveyBpMedsView = SurveyView.extend({
  initialize : function(attrs) {
    SurveyView.prototype.initialize.apply(this, arguments);
    this.updateMedCountVis(this.getToggleButton());
  },
  events : _.extend({
    "change #bp-meds-toggle" : "handleMedCountToggle"
  }, SurveyView.prototype.events),
  getToggleButton : function() {
    return this.$("#bp-meds-toggle");
  },
  handleMedCountToggle : function(e, data) {
    this.updateMedCountVis($(e.currentTarget));
  },
  updateMedCountVis : function($toggle) {
    var $div = this.$("#bp-meds-count");
    if ($toggle.val() === "true") {
      if (this.$el.is(":visible")) {
        $div.slideDown();
      } else {
        $div.show();
      }
    } else {
      if (this.$el.is(":visible")) {
        $div.slideUp();
      } else {
        $div.hide();
      }
    }
  }
});

var SurveyHistoryView = SurveyView.extend({
  initialize : function(attrs) {
    SurveyView.prototype.initialize.apply(this, arguments);
    this.updateDiabetesVis(this.getToggleButton());
  },
  events : _.extend({
    "change #diabetes-toggle" : "handleDiabetesToggle"
  }, SurveyView.prototype.events),
  getToggleButton : function() {
    return this.$("#diabetes-toggle");
  },
  handleDiabetesToggle : function(e, data) {
    this.updateDiabetesVis($(e.currentTarget));
  },
  updateDiabetesVis : function($toggle) {
    if ($toggle.val() === "true") {
      if (this.$el.is(":visible")) {
        this.$(".hba1c").slideDown();
      } else {
        this.$(".hba1c").show();
      }
    } else {
      if (this.$el.is(":visible")) {
        this.$(".hba1c").slideUp();
      } else {
        this.$(".hba1c").hide();
      }
    }
  }
});

var SurveyKnowsBpView = SurveyView.extend({
  initialize : function(attrs) {
    SurveyView.prototype.initialize.apply(this, arguments);
    var $checked = this.$("input[name='knows-bp']:checked");
    this.updateNextTarget($checked);
    this.updateLocationsVis($checked);
    this.manageSubmitTarget = false;
  },
  events : _.extend({
    "change #knows-bp-radio-t" : "handleKnowsBpRadio",
    "change #knows-bp-radio-f" : "handleKnowsBpRadio"
  }, SurveyView.prototype.events),
  handleKnowsBpRadio : function(e, data) {
    var $input = $(e.currentTarget);
    if (!$input.prop("checked")) {
      return;
    }
    this.updateNextTarget($input);
    this.updateLocationsVis($input);
  },
  updateLocationsVis : function($selectedRadio) {
    if ($selectedRadio.val() === "false") {
      if (this.$el.is(":visible")) {
        this.$(".screening-note").slideDown();
      } else {
        this.$(".screening-note").show();
      }
    } else {
      if (!this.$el.is(":visible")) {
        this.$(".screening-note").hide();
      } else {
        this.$(".screening-note").slideUp();
      }
    }
  },
  updateNextTarget : function($selectedRadio) {
    var page;
    if ($selectedRadio.val() === "true") {
      page = "#blood-pressure";
    } else {
      page = this.model.hasCompletedRequired() ? "#basic-profile" : "#knows-chol";
    }
    this.$(".dynamic-next").attr("href", page);
  }
});

var SurveyKnowsCholView = SurveyView.extend({
  initialize : function(attrs) {
    SurveyView.prototype.initialize.apply(this, arguments);
    var $checked = this.$("input[name='knows-chol']:checked");
    this.updateNextTarget($checked);
    this.updateLocationsVis($checked);
    this.manageSubmitTarget = false;
  },
  events : _.extend({
    "change #knows-chol-radio-t" : "handleKnowsCholRadio",
    "change #knows-chol-radio-f" : "handleKnowsCholRadio"
  }, SurveyView.prototype.events),
  handleKnowsCholRadio : function(e, data) {
    var $input = $(e.currentTarget);
    if (!$input.prop("checked")) {
      return;
    }
    this.updateNextTarget($input);
    this.updateLocationsVis($input);
  },
  updateLocationsVis : function($selectedRadio) {
    if ($selectedRadio.val() === "false") {
      if (this.$el.is(":visible")) {
        this.$(".screening-note").slideDown();
      } else {
        this.$(".screening-note").show();
      }
    } else {
      if (!this.$el.is(":visible")) {
        this.$(".screening-note").hide();
      } else {
      	this.$(".screening-note").slideUp();
      }
    }
  },
  updateNextTarget : function($selectedRadio) {
    var page;
    if ($selectedRadio.val() === "true") {
      page = "#cholesterol";
    } else {
      page = this.model.hasCompletedRequired() ? "#basic-profile" : "#confirmation";
    }
    this.$(".dynamic-next").attr("href", page);
  }
});

var WelcomeView = SurveyView.extend({
  initialize : function(attrs) {
    SurveyView.prototype.initialize.apply(this, arguments);
  },
  events : _.extend({
    "click .terms" : "handleTermsClicked",
    "pagebeforeshow" : "updateView"
  }, SurveyView.prototype.events),
  handleTermsClicked : function(e) {
    window.open("http://www.knowyourheart.info/terms.html");
  },
  updateView : function(e, data) {
    var progressPage = this.model.get("progress");
    var $submit = this.$("button[type=submit]");
    if (progressPage && !this.model.hasCompletedRequired()) {
      this.$(".startbtn").attr("href", "#" + progressPage);
      this.$("#terms-check").prop("checked", true).checkboxradio("refresh");
      $submit.html("Continue");
    } else {
      $submit.html("Get Started");
    }
  }
});

/*
 * Events
*/
$(document).ready(function() {
  console.debug("ready");
});
$(document).on("pagebeforeload", function(e, data) {
  console.debug("pagebeforeload");
});
$(document).on("pageload", function(e, data) {
  console.debug("pageload");
});
$(document).on("pageloadfailed", function(e, data) {
  console.debug("pageloadfailed");
});

$(document).on("pagebeforechange", function(e, data) {
  var page = data.toPage;
  console.debug((_.isString(page) ? "\n\n" : "") + "pagebeforechange - " + (_.isString(page) ? page : page.attr("id")));
});
$(document).on("pagechange", function(e, data) {
  var page = data.toPage;
  console.debug("pagechange - " + (_.isString(page) ? page : page.attr("id")));
});
$(document).on("pagechangefailed", function(e, data) {
  var page = data.toPage;
  console.debug("pagechangefailed - " + (_.isString(page) ? page : page.attr("id")));
});

$(document).on("pagebeforeshow", function(e, data) {
  var prevPage = data.prevPage.length === 0 ? "none" : data.prevPage.attr("id");
  console.debug("pagebeforeshow - " + prevPage + " to " + e.target.id);
});
$(document).on("pagebeforehide", function(e, data) {
  console.debug("pagebeforehide - " + e.target.id + " to " + data.nextPage.attr("id"));
});
$(document).on("pageshow", function(e, data) {
  var prevPage = data.prevPage.length === 0 ? "none" : data.prevPage.attr("id");
  console.debug("pageshow - " + prevPage + " to " + e.target.id);
});
$(document).on("pagehide", function(e, data) {
  console.debug("pagehide - " + e.target.id + " to " + data.nextPage.attr("id"));
});

$(document).on("pagebeforecreate", function(e) {
  console.debug("pagebeforecreate - " + e.target.id);
});
$(document).on("pagecreate", function(e) {
  console.debug("pagecreate - " + e.target.id);
});
$(document).on("pageinit", function(e) {
  console.debug("pageinit - " + e.target.id);
  
  $.support.cors = true;
  $.mobile.allowCrossDomainPages = true;

  if (gIsFirstPageInit) {
    gIsFirstPageInit = false;
    doFirstPageInit();
  }

  if (e.target.id === "loading") {
    if (gCurrentUser.hasCompletedRequired()) {
      $.mobile.changePage("#home", {
        transition : "none"
      });
    } else {
      $.mobile.changePage("#welcome", {
        transition : "none"
      });
    }
  }
});
$(document).on("pageremove", function(e) {
  console.debug("pageremove - " + e.target.id);
});

/*
* Initialization
*/

// init user
if (!localStorage["currentUsername"]) {
  console.info("user not found in localStorage - creating one");

  createUser();
} else {
  console.info("found user in localStorage: " + localStorage["currentUsername"]);

  gCurrentUser = new User({
    username : localStorage["currentUsername"]
  });
  gCurrentUser.fetch({
    success : function(model, resp) {
      // this gets called twice (once for local and once for StackMob)
      console.info("fetched user " + model.get("username") +
        (model.isFetching() ? " (still fetching)" : " (done fetching)"));

      if (model.get("risk_state") !== User.RISK_STATE.UP_TO_DATE) {
        model.set("risk_state", User.RISK_STATE.CHANGED);
      }
      model.calculateRisk();
    },
    error : function(model, resp, options) {
      console.error("failed to fetch user: " + resp.error +
        (model.isFetching() ? " (still fetching)" : " (done fetching)"));

      // TODO - this is a bit iffy, since it could be a local or remoteerror,
      // and uncertain order (though likely local first); assume remote error for
      // now
      if (!resp.error || resp.error.indexOf("does not exist")) {
        createUser(model);
      }

      model.calculateRisk();
    }
  });
}
