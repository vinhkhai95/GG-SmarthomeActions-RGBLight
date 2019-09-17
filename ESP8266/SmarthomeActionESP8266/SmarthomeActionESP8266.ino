#include <ESP8266WiFi.h>
#include <FirebaseArduino.h>

#define LED_PIN 16

// Set these to run example.
#define FIREBASE_HOST "testsmarthome-8bc97.firebaseio.com"
#define FIREBASE_AUTH "7LQg1B5sQSVZQgTnwkfh6BvRgF7hImWIYJT1v5cd"
#define WIFI_SSID "YOUR-SSID"
#define WIFI_PASSWORD "YOUR-PASSWORD"

char databuf[500];
String strBrightness = "";
String strSpectrumRGB = "";
String strOn = "";

void setup() {
  Serial.begin(115200);
  // connect to wifi.
  pinMode(LED_PIN, OUTPUT);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("connecting");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  Serial.println();
  Serial.print("connected: ") ;
  Serial.println(WiFi.localIP());
  Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH);
  Firebase.stream("/smartlight");
}

void loop() {
  if (Firebase.failed()) {
    Serial.println("streaming error");
    Serial.println(Firebase.error());
  }

  if (Firebase.available()) {
    FirebaseObject event = Firebase.readEvent();
    String eventType = event.getString("type");

    if (eventType == "put" || eventType == "patch") {
      String path = event.getString("path");
      Serial.println(String("path: ") + path);

      JsonVariant jsonVariant = event.getJsonVariant("data");
      jsonVariant.prettyPrintTo(databuf);
      Serial.println(databuf);
      StaticJsonBuffer<500> jb;
      JsonObject& root = jb.parseObject(databuf);
      if (!root.success()) {
        Serial.println(F("Parsing failed!"));
        return;
      }
      //First SYNC
      if (path == "/") {
        String strBrightness = root["Brightness"];
        String strSpectrumRGB = root["Color"]["spectrumRGB"];
        String strOn = root["OnOff"]["on"];
        if (strBrightness != "") {
          Serial.println(String("strBrightness: ") + strBrightness);
        }
        if (strSpectrumRGB != "") {
          Serial.println(String("strSpectrumRGB: ") + strSpectrumRGB);
        }
        if (strOn != "") {          
          Serial.println(String("strOn: ") + strOn);
          if (strOn == "true") {
            digitalWrite(LED_PIN, LOW);
          }
          else digitalWrite(LED_PIN, HIGH);
        }
      }
      
      //New EXCUTION?
      else if (path == "/Color") {
        String strSpectrumRGB = root["spectrumRGB"];
        if (strSpectrumRGB != nullptr) {
          Serial.println(String("strSpectrumRGB: ") + strSpectrumRGB);
        }
      }

      else if (path == "/OnOff") {
        String strOn = root["on"];
        if (strOn != nullptr) {
          Serial.println(String("strOn: ") + strOn);
          if (strOn == "true") {
            digitalWrite(LED_PIN, LOW);
          }
          else digitalWrite(LED_PIN, HIGH);
        }
      }
    }
  }
}
