package main

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

func main() {
	var upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}

	fs := http.FileServer(http.Dir("./pub"))
	http.Handle("/", fs)
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println(err)
			return
		}
		defer conn.Close()
		for {
			t, msg, err := conn.ReadMessage()
			if err != nil {
				log.Println(err)
				return
			}
			log.Println("Received:", string(msg))
			err = conn.WriteMessage(t, msg)
			if err != nil {
				log.Println(err)
				return
			}
		}
	})	

	log.Println("Listening on :8080...")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal(err)
	}
}