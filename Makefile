.PHONY: all clean cpp test

all: cpp

cpp:
	$(MAKE) -C rtweb/cpp all

clean:
	$(MAKE) -C rtweb/cpp clean
