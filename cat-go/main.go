package main

import (
	"io"
	"os"
)

func main() {
	args := os.Args[1:]

	if len(args) == 0 {
		io.Copy(os.Stdout, os.Stdin)
	} else {
		for _, arg := range args {
			f, err := os.Open(arg)
			if err != nil {
				println(err.Error())
				os.Exit(1)
			}
			defer f.Close()

			io.Copy(os.Stdout, f)
		}

	}

}
